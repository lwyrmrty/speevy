// lib/signatureapi/env.ts
//
// Server-only typed accessors for SignatureAPI environment variables. Mirrors
// the centralization pattern used for Supabase (lib/supabase/env.ts) and Loops
// (lib/loops/transactional.ts): read process.env in one place, expose typed
// getters + a presence check, never expose the secret to the client.
//
// None of these are NEXT_PUBLIC_*; the API key and webhook secret must never be
// bundled into client code. The runtime guard below fails loudly if this module
// is ever pulled into a browser bundle.

if (typeof window !== 'undefined') {
  throw new Error('lib/signatureapi/env must only be imported on the server.');
}

const DEFAULT_BASE_URL = 'https://api.signatureapi.com';

export function getSignatureApiBaseUrl() {
  return (process.env.SIGNATUREAPI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
}

export function getSignatureApiKey() {
  return process.env.SIGNATUREAPI_API_KEY;
}

export function getSignatureApiWebhookSecret() {
  return process.env.SIGNATUREAPI_WEBHOOK_SECRET;
}

export function hasSignatureApiEnv() {
  return Boolean(getSignatureApiKey());
}

export function hasSignatureApiWebhookEnv() {
  return Boolean(getSignatureApiWebhookSecret());
}
