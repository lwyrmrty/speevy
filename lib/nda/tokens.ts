// lib/nda/tokens.ts
//
// HMAC-signed, expiring tokens for the NDA UX layer. Two token kinds:
//
//  - Onboarding token: lets a just-created pending `lps` lead (who has NO auth
//    session yet) reach the account-NDA signing ceremony at /onboarding/nda.
//    Encodes the lp_id + issued-at; verification returns the lp_id or null.
//  - Download token: bound to a specific account_ndas / opportunity_ndas row,
//    emailed to the signer so they can re-fetch a fresh, short-lived signed
//    Storage URL for their sealed PDF without exposing the raw storage key.
//
// Both are signed with the Supabase service-role key (mirroring
// lib/opportunity-access.ts), distinguished by a kind-specific version prefix so
// a token of one kind can never validate as the other. They carry no secret
// beyond the ids they scope, and are time-boxed via the issued-at + a TTL. This
// is server-only — the service-role key must never reach the browser.

import { createHmac, timingSafeEqual } from 'node:crypto';

import { getSupabaseServiceRoleKey } from '@/lib/supabase/env';

if (typeof window !== 'undefined') {
  throw new Error('lib/nda/tokens must only be imported on the server.');
}

const ONBOARDING_VERSION = 'nda-onb-v1';
const DOWNLOAD_VERSION = 'nda-dl-v1';

// Generous but bounded windows: onboarding links may sit in an inbox before the
// lead returns; download links are re-fetchable for a sane window (the route
// re-issues a fresh signed URL on each click, so this is the link lifetime, not
// the signed-URL lifetime).
export const NDA_ONBOARDING_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
export const NDA_DOWNLOAD_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type NdaTier = 'account' | 'opportunity';

type OnboardingTokenPayload = {
  v: string;
  lp: string; // lp id
  t: number; // issued-at (ms)
};

type DownloadTokenPayload = {
  v: string;
  k: NdaTier; // tier
  id: string; // account_ndas / opportunity_ndas row id
  t: number; // issued-at (ms)
};

function getSigningSecret() {
  const secret = getSupabaseServiceRoleKey();
  if (!secret) {
    throw new Error('NDA token signing secret is not configured.');
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

function encode(payload: object) {
  const payloadSegment = base64UrlEncode(JSON.stringify(payload));
  return `${payloadSegment}.${sign(payloadSegment)}`;
}

// Constant-time signature check + JSON parse. Returns the parsed payload only
// when the signature matches; never throws on malformed input.
function decode<T>(token: string | undefined): T | null {
  if (!token) return null;

  const [payloadSegment, signatureSegment] = token.split('.');
  if (!payloadSegment || !signatureSegment) return null;

  const expected = Buffer.from(sign(payloadSegment));
  const provided = Buffer.from(signatureSegment);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    return JSON.parse(base64UrlDecode(payloadSegment)) as T;
  } catch {
    return null;
  }
}

export function createNdaOnboardingToken(lpId: string) {
  const payload: OnboardingTokenPayload = { v: ONBOARDING_VERSION, lp: lpId, t: Date.now() };
  return encode(payload);
}

export function buildNdaOnboardingUrl(lpId: string) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://speevy.vc').replace(/\/$/, '');
  return `${appUrl}/onboarding/nda?token=${createNdaOnboardingToken(lpId)}`;
}

// Returns the lp_id if the token is a valid, unexpired onboarding token.
export function verifyNdaOnboardingToken(token: string | undefined): string | null {
  const payload = decode<OnboardingTokenPayload>(token);
  if (
    !payload
    || payload.v !== ONBOARDING_VERSION
    || typeof payload.lp !== 'string'
    || !payload.lp
    || typeof payload.t !== 'number'
    || Date.now() - payload.t > NDA_ONBOARDING_TTL_MS
  ) {
    return null;
  }
  return payload.lp;
}

export function createNdaDownloadToken(tier: NdaTier, rowId: string) {
  const payload: DownloadTokenPayload = { v: DOWNLOAD_VERSION, k: tier, id: rowId, t: Date.now() };
  return encode(payload);
}

// Returns the { tier, rowId } if the token is a valid, unexpired download token.
export function verifyNdaDownloadToken(
  token: string | undefined,
): { tier: NdaTier; rowId: string } | null {
  const payload = decode<DownloadTokenPayload>(token);
  if (
    !payload
    || payload.v !== DOWNLOAD_VERSION
    || (payload.k !== 'account' && payload.k !== 'opportunity')
    || typeof payload.id !== 'string'
    || !payload.id
    || typeof payload.t !== 'number'
    || Date.now() - payload.t > NDA_DOWNLOAD_TTL_MS
  ) {
    return null;
  }
  return { tier: payload.k, rowId: payload.id };
}
