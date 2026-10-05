import type { createSupabaseAdminClient } from '@/lib/supabase/admin';

import {
  gateRateLimitExceeded,
  incrementGateRateLimit,
} from '@/lib/opportunity-rate-limit';

type AdminSupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

// Login and invite-code throttles. Real Speevy traffic is one person
// requesting a code and typing it once, so these windows are tight.
// Buckets reuse public.increment_gate_rate_limit (see
// supabase/migrations/0011_gate_rate_limits.sql) with an `auth-` prefix so
// they never share rows with opportunity-gate keys (`gate-pwd:`,
// `gate-code-email:`, `gate-code-ip:`).

export const AUTH_RATE_LIMIT_MESSAGE =
  'Too many attempts. Wait a few minutes and try again.';

// Every send or verify that reaches the action, including unknown emails and
// invalid input. Shared across both actions.
export const AUTH_ATTEMPT_MAX_PER_IP = 8;
export const AUTH_ATTEMPT_WINDOW_SECONDS = 10 * 60;

// Code issuance per recipient. generateLink replaces the previous code, so
// a burst of sends is the abuse we are stopping.
export const AUTH_CODE_SEND_MAX_PER_EMAIL = 2;
export const AUTH_CODE_SEND_WINDOW_SECONDS = 30 * 60;

// Code checks per recipient, before verifyOtp.
export const AUTH_CODE_VERIFY_MAX_PER_EMAIL = 5;
export const AUTH_CODE_VERIFY_WINDOW_SECONDS = 15 * 60;

export type AuthRateLimitKind = 'send' | 'verify';

export function authAttemptIpBucket(clientIp: string): string {
  return `auth-attempt-ip:${clientIp}`;
}

export function authCodeSendBucket(email: string): string {
  return `auth-code-send:${email.trim().toLowerCase()}`;
}

export function authCodeVerifyBucket(email: string): string {
  return `auth-code-verify:${email.trim().toLowerCase()}`;
}

// Increments the shared IP bucket first, then the per-email bucket when the
// attempt has a recipient. Returns true when a limit is exceeded.
// A null counter (backend unavailable) does not block — same fail-open as
// the opportunity gate — so a counter outage cannot lock every LP out.
export async function authRateLimitExceeded(
  supabase: AdminSupabaseClient,
  input: {
    kind: AuthRateLimitKind;
    clientIp: string;
    email: string | null;
  },
): Promise<boolean> {
  const ipCount = await incrementGateRateLimit(
    supabase,
    authAttemptIpBucket(input.clientIp),
    AUTH_ATTEMPT_WINDOW_SECONDS,
  );

  if (gateRateLimitExceeded(ipCount, AUTH_ATTEMPT_MAX_PER_IP)) {
    return true;
  }

  if (!input.email) {
    return false;
  }

  if (input.kind === 'send') {
    const sendCount = await incrementGateRateLimit(
      supabase,
      authCodeSendBucket(input.email),
      AUTH_CODE_SEND_WINDOW_SECONDS,
    );
    return gateRateLimitExceeded(sendCount, AUTH_CODE_SEND_MAX_PER_EMAIL);
  }

  const verifyCount = await incrementGateRateLimit(
    supabase,
    authCodeVerifyBucket(input.email),
    AUTH_CODE_VERIFY_WINDOW_SECONDS,
  );
  return gateRateLimitExceeded(verifyCount, AUTH_CODE_VERIFY_MAX_PER_EMAIL);
}
