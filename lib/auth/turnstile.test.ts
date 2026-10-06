import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { sendLoginCode, verifyLoginCode } from '@/app/login/actions';
import { sendInviteCode, verifyInviteCode } from '@/app/invite/[token]/actions';
import { submitInvestorRequest } from '@/app/join/[token]/actions';
import {
  sendLoginCodeFlow,
  verifyLoginCodeFlow,
  type LoginCodeFlowDeps,
} from '@/lib/auth/login-code-flow';
import { TURNSTILE_USER_MESSAGE } from '@/lib/auth/turnstile';
import type { createSupabaseAdminClient } from '@/lib/supabase/admin';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TOKEN = 'test-turnstile-token';
const TEST_SECRET = 'test-turnstile-secret';

const ENV_KEYS = [
  'TURNSTILE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'LOOPS_API_KEY',
  'LOOPS_TEMPLATE_LOGIN_CODE',
  'LOOPS_TEMPLATE_LP_SIGNUP_RECEIVED',
  'LOOPS_TEMPLATE_ADMIN_LP_ACCESS_REQUEST',
  'ZAPIER_LP_ACCESS_REQUEST_WEBHOOK_URL',
] as const;

const savedEnv = new Map<string, string | undefined>();
const originalFetch = globalThis.fetch;

type SiteverifyMode =
  | { kind: 'success' }
  | { kind: 'rejected'; errorCode: string }
  | { kind: 'http-error' }
  | { kind: 'throw' };

let mode: SiteverifyMode = { kind: 'success' };
let siteverifyCalls = 0;

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = savedEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function clearSideEffectEnv() {
  for (const key of ENV_KEYS) {
    if (key !== 'TURNSTILE_SECRET_KEY') delete process.env[key];
  }
  process.env.TURNSTILE_SECRET_KEY = TEST_SECRET;
}

before(() => {
  for (const key of ENV_KEYS) savedEnv.set(key, process.env[key]);
  clearSideEffectEnv();
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url !== SITEVERIFY_URL) {
      throw new Error('unexpected fetch in turnstile test');
    }
    siteverifyCalls += 1;
    assert.equal(init?.method, 'POST');
    const rawBody = init?.body;
    const body = typeof rawBody === 'string'
      ? rawBody
      : rawBody instanceof URLSearchParams
        ? rawBody.toString()
        : '';
    assert.equal(body.includes(`response=${TOKEN}`), true);
    assert.equal(body.includes(`secret=${TEST_SECRET}`), true);
    if (mode.kind === 'throw') {
      throw new Error('siteverify unreachable');
    }
    if (mode.kind === 'http-error') {
      return new Response('nope', { status: 503 });
    }
    if (mode.kind === 'rejected') {
      return new Response(
        JSON.stringify({ success: false, 'error-codes': [mode.errorCode] }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
});

after(() => {
  globalThis.fetch = originalFetch;
  restoreEnv();
});

function flowDeps(): LoginCodeFlowDeps & {
  issued: string[];
  emailed: string[];
  verified: string[];
  rateChecks: string[];
} {
  const issued: string[] = [];
  const emailed: string[] = [];
  const verified: string[] = [];
  const rateChecks: string[] = [];

  return {
    async isRateLimited(kind) {
      rateChecks.push(kind);
      return false;
    },
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
    rateChecks,
  };
}

function emailForm(token: string | null) {
  const formData = new FormData();
  formData.set('email', 'lp@harpoon.vc');
  if (token) formData.set('cf-turnstile-response', token);
  return formData;
}

function codeForm(token: string | null) {
  const formData = emailForm(token);
  formData.set('code', '123456');
  return formData;
}

function investorForm(token: string | null) {
  const formData = new FormData();
  if (token) formData.set('cf-turnstile-response', token);
  formData.set('token', 'request-link');
  formData.set('firstName', 'Ada');
  formData.set('lastName', 'Lovelace');
  formData.set('email', 'ada@example.com');
  formData.set('companyName', 'Analytical Engines');
  formData.append('sectors', 'AI');
  formData.set('investmentRangeMin', '50000');
  formData.set('investmentRangeMax', '100000');
  formData.set('accreditedInvestor', 'on');
  formData.set('priorHarpoonInvestor', 'on');
  return formData;
}

const idle = { status: 'idle' as const, message: '' };

function recordingAdmin(events: string[]) {
  const builder = {
    select() {
      return builder;
    },
    eq() {
      return builder;
    },
    upsert() {
      events.push('upsert');
      return builder;
    },
    insert() {
      events.push('insert');
      return Promise.resolve({ error: null });
    },
    maybeSingle() {
      events.push('maybeSingle');
      return Promise.resolve({ data: null, error: null });
    },
    single() {
      events.push('single');
      return Promise.resolve({ data: { id: 'lp-test' }, error: null });
    },
  };

  return {
    from(table: string) {
      events.push(`from:${table}`);
      return builder;
    },
  };
}

describe('turnstile gates', { concurrency: false }, () => {
  before(() => {
    mode = { kind: 'success' };
    siteverifyCalls = 0;
    clearSideEffectEnv();
  });

  it('stops a login code send before rate limits, issuance, or email when the token is missing', async () => {
    const callsBefore = siteverifyCalls;
    const deps = flowDeps();
    const result = await sendLoginCodeFlow(emailForm(null), deps);

    assert.deepEqual(result, { status: 'error', message: TURNSTILE_USER_MESSAGE });
    assert.deepEqual(deps.rateChecks, []);
    assert.deepEqual(deps.issued, []);
    assert.deepEqual(deps.emailed, []);
    assert.equal(siteverifyCalls, callsBefore);
  });

  it('stops a login code send when siteverify rejects the token', async () => {
    mode = { kind: 'rejected', errorCode: 'invalid-input-response' };
    const deps = flowDeps();
    const result = await sendLoginCodeFlow(emailForm(TOKEN), deps);

    assert.equal(result.message, TURNSTILE_USER_MESSAGE);
    assert.equal(result.message.includes('invalid-input-response'), false);
    assert.deepEqual(deps.rateChecks, []);
    assert.deepEqual(deps.issued, []);
    assert.deepEqual(deps.emailed, []);
    mode = { kind: 'success' };
  });

  it('stops a login code send when the secret is missing or siteverify cannot be reached', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const callsBefore = siteverifyCalls;
    const missingSecret = flowDeps();
    const missingSecretResult = await sendLoginCodeFlow(emailForm(TOKEN), missingSecret);
    assert.equal(missingSecretResult.message, TURNSTILE_USER_MESSAGE);
    assert.equal(siteverifyCalls, callsBefore);
    assert.deepEqual(missingSecret.issued, []);

    process.env.TURNSTILE_SECRET_KEY = TEST_SECRET;
    mode = { kind: 'throw' };
    const unreachable = flowDeps();
    const unreachableResult = await sendLoginCodeFlow(emailForm(TOKEN), unreachable);
    assert.equal(unreachableResult.message, TURNSTILE_USER_MESSAGE);
    assert.deepEqual(unreachable.emailed, []);

    mode = { kind: 'http-error' };
    const httpError = flowDeps();
    const httpErrorResult = await sendLoginCodeFlow(emailForm(TOKEN), httpError);
    assert.equal(httpErrorResult.message, TURNSTILE_USER_MESSAGE);
    assert.deepEqual(httpError.issued, []);
    mode = { kind: 'success' };
  });

  it('continues a login code send into issuance and email after siteverify succeeds', async () => {
    const deps = flowDeps();
    const result = await sendLoginCodeFlow(emailForm(TOKEN), deps);

    assert.equal(result.status, 'success');
    assert.equal(result.message, 'Check your email for a 6-digit Speevy login code.');
    assert.deepEqual(deps.rateChecks, ['send']);
    assert.deepEqual(deps.issued, ['lp@harpoon.vc']);
    assert.deepEqual(deps.emailed, ['lp@harpoon.vc']);
  });

  it('stops code verification before the rate limit and verifyOtp when the token is missing or rejected', async () => {
    const missing = flowDeps();
    const missingResult = await verifyLoginCodeFlow(codeForm(null), missing);
    assert.equal(missingResult.message, TURNSTILE_USER_MESSAGE);
    assert.deepEqual(missing.rateChecks, []);
    assert.deepEqual(missing.verified, []);

    mode = { kind: 'rejected', errorCode: 'timeout-or-duplicate' };
    const rejected = flowDeps();
    const rejectedResult = await verifyLoginCodeFlow(codeForm(TOKEN), rejected);
    assert.equal(rejectedResult.message, TURNSTILE_USER_MESSAGE);
    assert.equal(rejectedResult.message.includes('timeout-or-duplicate'), false);
    assert.deepEqual(rejected.verified, []);
    mode = { kind: 'success' };
  });

  it('continues code verification into verifyOtp after siteverify succeeds', async () => {
    const deps = flowDeps();
    const result = await verifyLoginCodeFlow(codeForm(TOKEN), deps);

    assert.deepEqual(deps.rateChecks, ['verify']);
    assert.deepEqual(deps.verified, ['lp@harpoon.vc:123456']);
    assert.equal(result.message, 'That code did not work. Request a new one and try again.');
  });

  it('stops the login actions before the demo or email path when the token is missing', async () => {
    const sendResult = await sendLoginCode(idle, emailForm(null));
    assert.equal(sendResult.message, TURNSTILE_USER_MESSAGE);

    const verifyResult = await verifyLoginCode(idle, codeForm(null));
    assert.equal(verifyResult.message, TURNSTILE_USER_MESSAGE);
  });

  it('continues the login action into the existing env check after siteverify succeeds', async () => {
    const result = await sendLoginCode(idle, emailForm(TOKEN));
    assert.equal(result.status, 'success');
    assert.equal(
      result.message,
      'Demo mode: Supabase is not configured yet. Add the emailed code once auth credentials are connected.',
    );
  });

  it('stops invite send and verify before the placeholder flow when the token is missing or rejected', async () => {
    const missingSend = await sendInviteCode(idle, emailForm(null));
    assert.equal(missingSend.message, TURNSTILE_USER_MESSAGE);
    assert.equal(missingSend.message.includes('Invite token validation'), false);

    mode = { kind: 'rejected', errorCode: 'invalid-input-response' };
    const rejectedVerify = await verifyInviteCode(idle, emailForm(TOKEN));
    assert.equal(rejectedVerify.message, TURNSTILE_USER_MESSAGE);
    assert.equal(rejectedVerify.message.includes('invitation token validation'), false);
    mode = { kind: 'success' };
  });

  it('continues invite send and verify into the existing flow after siteverify succeeds', async () => {
    const sendResult = await sendInviteCode(idle, emailForm(TOKEN));
    assert.equal(sendResult.status, 'success');
    assert.equal(sendResult.email, 'lp@harpoon.vc');
    assert.match(sendResult.message, /Invite token validation is next/);

    const verifyResult = await verifyInviteCode(idle, codeForm(TOKEN));
    assert.equal(verifyResult.status, 'error');
    assert.match(verifyResult.message, /Invite code verification will be enabled/);
  });

  it('stops an access request before an LP insert when the token is missing or siteverify fails', async () => {
    const events: string[] = [];
    const deps = {
      hasServiceRoleEnv: () => true,
      createAdminClient() {
        events.push('createAdminClient');
        throw new Error('admin client should not be created');
      },
    };

    const missing = await submitInvestorRequest(idle, investorForm(null), deps);
    assert.equal(missing.message, TURNSTILE_USER_MESSAGE);
    assert.deepEqual(events, []);

    mode = { kind: 'rejected', errorCode: 'invalid-input-response' };
    const rejected = await submitInvestorRequest(idle, investorForm(TOKEN), deps);
    assert.equal(rejected.message, TURNSTILE_USER_MESSAGE);
    assert.equal(rejected.message.includes('invalid-input-response'), false);
    assert.deepEqual(events, []);
    mode = { kind: 'success' };
  });

  it('continues an access request into the LP insert after siteverify succeeds', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-nda-signing-secret';
    const events: string[] = [];
    const admin = recordingAdmin(events);
    const result = await submitInvestorRequest(idle, investorForm(TOKEN), {
      hasServiceRoleEnv: () => true,
      // The stand-in only implements the lps upsert chain this action calls.
      createAdminClient: () => admin as unknown as ReturnType<typeof createSupabaseAdminClient>,
    });

    assert.equal(result.status, 'success');
    assert.match(result.message, /Request submitted/);
    assert.equal(events.includes('upsert'), true);
    assert.equal(events.includes('insert'), true);
    assert.equal(typeof result.onboardingUrl, 'string');
  });
});
