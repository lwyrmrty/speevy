import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

import { getSupabaseServiceRoleKey } from '@/lib/supabase/env';

// Email verification codes for the password-protected opportunity gate.
// Codes are 6-digit numeric, single-use, attempt-limited, and short-lived. We
// never store the plaintext code: only an HMAC of it is persisted (in
// opportunity_access_verifications) and compared server-side in constant time.

export const VERIFICATION_CODE_LENGTH = 6;
export const VERIFICATION_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const VERIFICATION_MAX_ATTEMPTS = 5;

function getSigningSecret() {
  const secret = getSupabaseServiceRoleKey();

  if (!secret) {
    throw new Error('Opportunity verification signing secret is not configured.');
  }

  return secret;
}

// Uniformly random 6-digit code, zero-padded so leading zeros are preserved.
export function generateVerificationCode() {
  return randomInt(0, 1_000_000).toString().padStart(VERIFICATION_CODE_LENGTH, '0');
}

export function hashVerificationCode(code: string) {
  return createHmac('sha256', getSigningSecret()).update(code).digest('base64url');
}

export function verificationCodeMatches(enteredCode: string, storedHash: string) {
  const expected = Buffer.from(hashVerificationCode(enteredCode));
  const provided = Buffer.from(storedHash);

  if (expected.length !== provided.length) {
    return false;
  }

  return timingSafeEqual(expected, provided);
}
