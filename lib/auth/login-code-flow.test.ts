import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AUTH_RATE_LIMIT_MESSAGE, authRateLimitExceeded } from '@/lib/auth-rate-limit';
import {
  sendLoginCodeFlow,
  verifyLoginCodeFlow,
  type LoginCodeFlowDeps,
} from '@/lib/auth/login-code-flow';
import type { createSupabaseAdminClient } from '@/lib/supabase/admin';

type AdminSupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

// The helper only calls increment_gate_rate_limit. This stand-in covers that
// call; the rest of the generated admin client is unused.
function countingAdmin(startAt: Map<string, number> = new Map()) {
  const counts = new Map(startAt);
  const keys: string[] = [];

  const client = {
    async rpc(
      fn: string,
      args: { p_bucket_key: string; p_window_seconds: number },
    ) {
      assert.equal(fn, 'increment_gate_rate_limit');
      keys.push(args.p_bucket_key);
      const next = (counts.get(args.p_bucket_key) ?? 0) + 1;
      counts.set(args.p_bucket_key, next);
      return { data: next, error: null };
    },
  };

  return {
    keys,
    client: client as unknown as AdminSupabaseClient,
  };
}

function flowDeps(
  overrides: Partial<LoginCodeFlowDeps> &
    Pick<LoginCodeFlowDeps, 'isRateLimited'>,
): LoginCodeFlowDeps & {
  issued: string[];
  emailed: string[];
  verified: string[];
} {
  const issued: string[] = [];
  const emailed: string[] = [];
  const verified: string[] = [];

  return {
    hasPublicEnv: () => true,
    hasServiceRoleEnv: () => true,
    hasLoopsLoginCodeEnv: () => true,
    getAuthorization: async () => ({ allowed: true, role: 'admin' }),
    async issueLoginCode(email) {
      issued.push(email);
      return '123456';
    },
    async sendLoginCodeEmail({ email }) {
      emailed.push(email);
    },
    async verifyOtp(email, code) {
      verified.push(`${email}:${code}`);
      return {
        status: 'error',
        email,
        message: 'That code did not work. Request a new one and try again.',
      };
    },
    issued,
    emailed,
    verified,
    ...overrides,
  };
}

function emailForm(email: string) {
  const formData = new FormData();
  formData.set('email', email);
  return formData;
}

function codeForm(email: string, code: string) {
  const formData = emailForm(email);
  formData.set('code', code);
  return formData;
}

describe('login code flow rate limit', () => {
  const clientIp = '203.0.113.20';

  it('sends on the first attempt and buckets separately from the opportunity gate', async () => {
    const admin = countingAdmin();
    const deps = flowDeps({
      isRateLimited: (kind, email) =>
        authRateLimitExceeded(admin.client, { kind, clientIp, email }),
    });

    const result = await sendLoginCodeFlow(emailForm('LP@harpoon.vc'), deps);

    assert.equal(result.status, 'success');
    assert.equal(result.message, 'Check your email for a 6-digit Speevy login code.');
    assert.deepEqual(deps.issued, ['LP@harpoon.vc']);
    assert.deepEqual(deps.emailed, ['LP@harpoon.vc']);
    assert.deepEqual(admin.keys, [
      'auth-attempt-ip:203.0.113.20',
      'auth-code-send:lp@harpoon.vc',
    ]);
    assert.equal(admin.keys.some((key) => key.startsWith('gate-')), false);
  });

  it('blocks an over-IP send before code issuance or email', async () => {
    const admin = countingAdmin(new Map([['auth-attempt-ip:203.0.113.20', 8]]));
    const deps = flowDeps({
      isRateLimited: (kind, email) =>
        authRateLimitExceeded(admin.client, { kind, clientIp, email }),
    });

    const result = await sendLoginCodeFlow(emailForm('lp@harpoon.vc'), deps);

    assert.deepEqual(result, {
      status: 'error',
      message: AUTH_RATE_LIMIT_MESSAGE,
    });
    assert.deepEqual(deps.issued, []);
    assert.deepEqual(deps.emailed, []);
    assert.deepEqual(admin.keys, ['auth-attempt-ip:203.0.113.20']);
  });

  it('blocks the third code send for one email before generateLink or email', async () => {
    const admin = countingAdmin(new Map([['auth-code-send:lp@harpoon.vc', 2]]));
    const deps = flowDeps({
      isRateLimited: (kind, email) =>
        authRateLimitExceeded(admin.client, { kind, clientIp, email }),
    });

    const result = await sendLoginCodeFlow(emailForm('lp@harpoon.vc'), deps);

    assert.equal(result.message, AUTH_RATE_LIMIT_MESSAGE);
    assert.deepEqual(deps.issued, []);
    assert.deepEqual(deps.emailed, []);
  });

  it('returns the same limit message for an email that cannot sign in', async () => {
    const admin = countingAdmin(new Map([['auth-code-send:stranger@example.com', 2]]));
    let authorizationChecks = 0;
    const deps = flowDeps({
      isRateLimited: (kind, email) =>
        authRateLimitExceeded(admin.client, { kind, clientIp, email }),
      async getAuthorization() {
        authorizationChecks += 1;
        return { allowed: false };
      },
    });

    const result = await sendLoginCodeFlow(emailForm('stranger@example.com'), deps);

    assert.equal(result.message, AUTH_RATE_LIMIT_MESSAGE);
    assert.equal(authorizationChecks, 0);
    assert.deepEqual(deps.issued, []);
    assert.deepEqual(deps.emailed, []);
  });

  it('keeps the generic reply for a disallowed email under the limit', async () => {
    const deps = flowDeps({
      isRateLimited: async () => false,
      getAuthorization: async () => ({ allowed: false }),
    });

    const result = await sendLoginCodeFlow(emailForm('stranger@example.com'), deps);

    assert.equal(result.status, 'success');
    assert.equal(
      result.message,
      'If this email is approved for Speevy, a login code will arrive shortly.',
    );
    assert.deepEqual(deps.issued, []);
    assert.deepEqual(deps.emailed, []);
  });

  it('verifies on the first attempt with an auth bucket, not a gate bucket', async () => {
    const admin = countingAdmin();
    const deps = flowDeps({
      isRateLimited: (kind, email) =>
        authRateLimitExceeded(admin.client, { kind, clientIp, email }),
    });

    const result = await verifyLoginCodeFlow(codeForm('lp@harpoon.vc', '123456'), deps);

    assert.equal(result.message, 'That code did not work. Request a new one and try again.');
    assert.deepEqual(deps.verified, ['lp@harpoon.vc:123456']);
    assert.deepEqual(admin.keys, [
      'auth-attempt-ip:203.0.113.20',
      'auth-code-verify:lp@harpoon.vc',
    ]);
    assert.equal(admin.keys.some((key) => key.startsWith('gate-')), false);
  });

  it('blocks the sixth code check before verifyOtp', async () => {
    const admin = countingAdmin(new Map([['auth-code-verify:lp@harpoon.vc', 5]]));
    const deps = flowDeps({
      isRateLimited: (kind, email) =>
        authRateLimitExceeded(admin.client, { kind, clientIp, email }),
    });

    const result = await verifyLoginCodeFlow(codeForm('lp@harpoon.vc', '123456'), deps);

    assert.equal(result.message, AUTH_RATE_LIMIT_MESSAGE);
    assert.deepEqual(deps.verified, []);
    assert.deepEqual(deps.issued, []);
    assert.deepEqual(deps.emailed, []);
  });

  it('counts invalid input against the IP and blocks before verifyOtp', async () => {
    const admin = countingAdmin(new Map([['auth-attempt-ip:203.0.113.20', 8]]));
    const deps = flowDeps({
      isRateLimited: (kind, email) =>
        authRateLimitExceeded(admin.client, { kind, clientIp, email }),
    });

    const result = await verifyLoginCodeFlow(codeForm('lp@harpoon.vc', 'nope'), deps);

    assert.equal(result.message, AUTH_RATE_LIMIT_MESSAGE);
    assert.deepEqual(deps.verified, []);
    assert.deepEqual(admin.keys, ['auth-attempt-ip:203.0.113.20']);
  });

  it('returns the validation error for a missing body when the limit allows it', async () => {
    const deps = flowDeps({
      isRateLimited: async (_kind, email) => {
        assert.equal(email, null);
        return false;
      },
    });

    const result = await sendLoginCodeFlow(undefined, deps);

    assert.equal(result.status, 'error');
    assert.equal(result.message, 'Enter a valid email address.');
    assert.deepEqual(deps.issued, []);
    assert.deepEqual(deps.emailed, []);
  });

  it('returns the validation error when formData.get throws', async () => {
    const deps = flowDeps({
      isRateLimited: async () => false,
    });
    const broken = {
      get() {
        throw new TypeError("Cannot read properties of undefined (reading 'get')");
      },
    };

    // FormData is the action's parameter type. This object is the runtime case
    // where get throws before a field can be read.
    const result = await sendLoginCodeFlow(broken as unknown as FormData, deps);

    assert.equal(result.message, 'Enter a valid email address.');
    assert.deepEqual(deps.issued, []);
  });

  it('still sends when the counter is unavailable', async () => {
    const client = {
      async rpc() {
        return { data: null, error: { message: 'unavailable' } };
      },
    };
    const deps = flowDeps({
      isRateLimited: (kind, email) =>
        // rpc() is the only admin-client method the rate-limit helper calls.
        authRateLimitExceeded(client as unknown as AdminSupabaseClient, {
          kind,
          clientIp,
          email,
        }),
    });

    const result = await sendLoginCodeFlow(emailForm('lp@harpoon.vc'), deps);

    assert.equal(result.status, 'success');
    assert.deepEqual(deps.issued, ['lp@harpoon.vc']);
    assert.deepEqual(deps.emailed, ['lp@harpoon.vc']);
  });
});
