import { createHmac, timingSafeEqual } from 'node:crypto';

import { getSupabaseServiceRoleKey } from '@/lib/supabase/env';

// Signed, opportunity-scoped access grant for "outsiders" who unlocked a
// password-protected opportunity via a shared direct link. They have no
// Supabase auth session, so the unlocked state lives in an httpOnly, signed,
// session-lifetime cookie. The cookie proves "this browser entered the correct
// password for this opportunity and identified themselves as <email>".
//
// This is an access deterrent + attribution tool tied to a password the admin
// chose; it is not a substitute for real authentication and must never grant
// access to anything other than the single opportunity it is scoped to.

const TOKEN_VERSION = 'v1';

type AccessTokenPayload = {
  v: string;
  o: string; // opportunity id
  e: string; // email entered at the gate
  t: number; // issued-at (ms)
};

function getSigningSecret() {
  const secret = getSupabaseServiceRoleKey();

  if (!secret) {
    throw new Error('Opportunity access signing secret is not configured.');
  }

  return secret;
}

function base64UrlEncode(input: string) {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function sign(payloadSegment: string) {
  return createHmac('sha256', getSigningSecret()).update(payloadSegment).digest('base64url');
}

export function opportunityAccessCookieName(opportunityId: string) {
  return `speevy_opp_access_${opportunityId}`;
}

export function createOpportunityAccessToken(opportunityId: string, email: string) {
  const payload: AccessTokenPayload = {
    v: TOKEN_VERSION,
    o: opportunityId,
    e: email,
    t: Date.now(),
  };
  const payloadSegment = base64UrlEncode(JSON.stringify(payload));
  return `${payloadSegment}.${sign(payloadSegment)}`;
}

// Returns the email the visitor entered at the gate if the token is valid for
// the given opportunity, otherwise null.
export function verifyOpportunityAccessToken(
  token: string | undefined,
  opportunityId: string,
): string | null {
  if (!token) {
    return null;
  }

  const [payloadSegment, signatureSegment] = token.split('.');

  if (!payloadSegment || !signatureSegment) {
    return null;
  }

  const expectedSignature = sign(payloadSegment);
  const provided = Buffer.from(signatureSegment);
  const expected = Buffer.from(expectedSignature);

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadSegment)) as AccessTokenPayload;

    if (payload.v !== TOKEN_VERSION || payload.o !== opportunityId || !payload.e) {
      return null;
    }

    return payload.e;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Email-verified cookie.
//
// Separate from the access cookie above: this records that a specific email
// completed the emailed-code verification for a specific opportunity. It lasts
// ~30 days and is keyed to email + opportunity so a returning visitor who
// re-enters the SAME email (and the correct password) can skip the code step.
// Entering a DIFFERENT email has no valid cookie and forces re-verification.
// It carries no secret beyond the email + opportunity it is scoped to, plus an
// issued-at used to enforce the 30-day lifetime independently of the cookie's
// own maxAge.
// ---------------------------------------------------------------------------
export const OPPORTUNITY_VERIFIED_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const VERIFIED_TOKEN_VERSION = 'v1';

type VerifiedTokenPayload = {
  v: string;
  o: string; // opportunity id
  e: string; // verified email
  t: number; // issued-at (ms)
};

export function opportunityVerifiedCookieName(opportunityId: string) {
  return `speevy_opp_verified_${opportunityId}`;
}

export function createOpportunityVerifiedToken(opportunityId: string, email: string) {
  const payload: VerifiedTokenPayload = {
    v: VERIFIED_TOKEN_VERSION,
    o: opportunityId,
    e: email,
    t: Date.now(),
  };
  const payloadSegment = base64UrlEncode(JSON.stringify(payload));
  return `${payloadSegment}.${sign(payloadSegment)}`;
}

// True only if the token is a valid, unexpired (<= 30 days) verification proof
// for this exact opportunity + email. Email comparison is case-insensitive
// because gate emails are normalized to lowercase.
export function isOpportunityVerifiedTokenValid(
  token: string | undefined,
  opportunityId: string,
  email: string,
): boolean {
  if (!token) {
    return false;
  }

  const [payloadSegment, signatureSegment] = token.split('.');

  if (!payloadSegment || !signatureSegment) {
    return false;
  }

  const expectedSignature = sign(payloadSegment);
  const provided = Buffer.from(signatureSegment);
  const expected = Buffer.from(expectedSignature);

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return false;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadSegment)) as VerifiedTokenPayload;

    if (
      payload.v !== VERIFIED_TOKEN_VERSION
      || payload.o !== opportunityId
      || typeof payload.e !== 'string'
      || payload.e.toLowerCase() !== email.toLowerCase()
      || typeof payload.t !== 'number'
      || Date.now() - payload.t > OPPORTUNITY_VERIFIED_TTL_MS
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
