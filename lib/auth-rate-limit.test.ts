import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AUTH_ATTEMPT_MAX_PER_IP,
  AUTH_ATTEMPT_WINDOW_SECONDS,
  AUTH_CODE_SEND_MAX_PER_EMAIL,
  AUTH_CODE_SEND_WINDOW_SECONDS,
  AUTH_CODE_VERIFY_MAX_PER_EMAIL,
  AUTH_CODE_VERIFY_WINDOW_SECONDS,
  authAttemptIpBucket,
  authCodeSendBucket,
  authCodeVerifyBucket,
  authRateLimitExceeded,
} from '@/lib/auth-rate-limit';
import type { createSupabaseAdminClient } from '@/lib/supabase/admin';

type AdminSupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

type RpcCall = {
  key: string;
  windowSeconds: number;
};

// authRateLimitExceeded only calls increment_gate_rate_limit. The cast stands
// in for the rest of the generated Supabase client, which this helper never uses.
function fakeAdmin(options: {
  counts?: Map<string, number>;
  failKeys?: Set<string>;
}): { client: AdminSupabaseClient; calls: RpcCall[] } {
  const calls: RpcCall[] = [];
  const counts = options.counts ?? new Map<string, number>();

  const client = {
    rpc: async (
      fn: string,
      args: { p_bucket_key: string; p_window_seconds: number },
    ) => {
      assert.equal(fn, 'increment_gate_rate_limit');
      calls.push({
        key: args.p_bucket_key,
        windowSeconds: args.p_window_seconds,
      });

      if (options.failKeys?.has(args.p_bucket_key)) {
        return { data: null, error: { message: 'unavailable' } };
      }

      const next = (counts.get(args.p_bucket_key) ?? 0) + 1;
      counts.set(args.p_bucket_key, next);
      return { data: next, error: null };
    },
  };

  return {
    calls,
    client: client as unknown as AdminSupabaseClient,
  };
}

describe('auth rate limit bucket keys', () => {
  it('uses auth prefixes that cannot collide with opportunity gate buckets', () => {
    const ip = '203.0.113.8';
    const email = 'LP@Harpoon.vc';

    const keys = [
      authAttemptIpBucket(ip),
      authCodeSendBucket(email),
      authCodeVerifyBucket(email),
    ];

    assert.deepEqual(keys, [
      'auth-attempt-ip:203.0.113.8',
      'auth-code-send:lp@harpoon.vc',
      'auth-code-verify:lp@harpoon.vc',
    ]);

    for (const key of keys) {
      assert.equal(key.startsWith('gate-'), false);
      assert.equal(key.includes('gate-pwd:'), false);
      assert.equal(key.includes('gate-code-email:'), false);
      assert.equal(key.includes('gate-code-ip:'), false);
    }

    assert.notEqual(authAttemptIpBucket(ip), `gate-pwd:some-deal:${ip}`);
    assert.notEqual(authAttemptIpBucket(ip), `gate-code-ip:${ip}`);
    assert.notEqual(authCodeSendBucket(email), 'gate-code-email:lp@harpoon.vc');
    assert.notEqual(authCodeVerifyBucket(email), 'gate-code-email:lp@harpoon.vc');
  });
});

describe('authRateLimitExceeded', () => {
  const clientIp = '203.0.113.8';
  const email = 'lp@harpoon.vc';

  it('allows a first send and records the shared IP bucket plus the send bucket', async () => {
    const { client, calls } = fakeAdmin({});

    const blocked = await authRateLimitExceeded(client, {
      kind: 'send',
      clientIp,
      email,
    });

    assert.equal(blocked, false);
    assert.deepEqual(calls, [
      {
        key: authAttemptIpBucket(clientIp),
        windowSeconds: AUTH_ATTEMPT_WINDOW_SECONDS,
      },
      {
        key: authCodeSendBucket(email),
        windowSeconds: AUTH_CODE_SEND_WINDOW_SECONDS,
      },
    ]);
  });

  it('blocks the IP before a per-email bucket is touched', async () => {
    const counts = new Map<string, number>([
      [authAttemptIpBucket(clientIp), AUTH_ATTEMPT_MAX_PER_IP],
    ]);
    const { client, calls } = fakeAdmin({ counts });

    const blocked = await authRateLimitExceeded(client, {
      kind: 'send',
      clientIp,
      email,
    });

    assert.equal(blocked, true);
    assert.deepEqual(
      calls.map((call) => call.key),
      [authAttemptIpBucket(clientIp)],
    );
  });

  it('shares the IP bucket across send and verify', async () => {
    const counts = new Map<string, number>();
    const { client } = fakeAdmin({ counts });

    for (let attempt = 0; attempt < AUTH_ATTEMPT_MAX_PER_IP / 2; attempt += 1) {
      assert.equal(
        await authRateLimitExceeded(client, {
          kind: 'send',
          clientIp,
          email: null,
        }),
        false,
      );
      assert.equal(
        await authRateLimitExceeded(client, {
          kind: 'verify',
          clientIp,
          email: null,
        }),
        false,
      );
    }

    assert.equal(
      await authRateLimitExceeded(client, {
        kind: 'verify',
        clientIp,
        email,
      }),
      true,
    );
    assert.equal(counts.has(authCodeVerifyBucket(email)), false);
  });

  it('blocks the third code send for one email inside the issuance window', async () => {
    const { client, calls } = fakeAdmin({});
    const results: boolean[] = [];

    for (let attempt = 0; attempt < AUTH_CODE_SEND_MAX_PER_EMAIL + 1; attempt += 1) {
      results.push(
        await authRateLimitExceeded(client, {
          kind: 'send',
          clientIp: `198.51.100.${attempt}`,
          email,
        }),
      );
    }

    assert.deepEqual(results, [false, false, true]);
    const sendCalls = calls.filter((call) => call.key === authCodeSendBucket(email));
    assert.equal(sendCalls.length, AUTH_CODE_SEND_MAX_PER_EMAIL + 1);
    assert.equal(sendCalls[0]?.windowSeconds, 30 * 60);
  });

  it('blocks the sixth code check for one email inside a 15 minute window', async () => {
    const { client, calls } = fakeAdmin({});
    const results: boolean[] = [];

    for (let attempt = 0; attempt < AUTH_CODE_VERIFY_MAX_PER_EMAIL + 1; attempt += 1) {
      results.push(
        await authRateLimitExceeded(client, {
          kind: 'verify',
          clientIp: `198.51.100.${attempt}`,
          email,
        }),
      );
    }

    assert.deepEqual(results, [false, false, false, false, false, true]);
    const verifyCalls = calls.filter((call) => call.key === authCodeVerifyBucket(email));
    assert.equal(verifyCalls.length, AUTH_CODE_VERIFY_MAX_PER_EMAIL + 1);
    assert.equal(verifyCalls[0]?.windowSeconds, AUTH_CODE_VERIFY_WINDOW_SECONDS);
  });

  it('fails open when the counter is unavailable', async () => {
    const { client, calls } = fakeAdmin({
      failKeys: new Set([authAttemptIpBucket(clientIp)]),
    });

    const blocked = await authRateLimitExceeded(client, {
      kind: 'send',
      clientIp,
      email,
    });

    assert.equal(blocked, false);
    assert.deepEqual(
      calls.map((call) => call.key),
      [authAttemptIpBucket(clientIp), authCodeSendBucket(email)],
    );
  });

  it('still counts an invalid attempt against the IP when no recipient is known', async () => {
    const { client, calls } = fakeAdmin({});

    const blocked = await authRateLimitExceeded(client, {
      kind: 'verify',
      clientIp,
      email: null,
    });

    assert.equal(blocked, false);
    assert.deepEqual(
      calls.map((call) => call.key),
      [authAttemptIpBucket(clientIp)],
    );
    assert.equal(calls[0]?.windowSeconds, AUTH_ATTEMPT_WINDOW_SECONDS);
  });
});
