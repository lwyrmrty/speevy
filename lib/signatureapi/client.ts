// lib/signatureapi/client.ts
//
// Server-only wrapper around the SignatureAPI REST API. Sets the X-API-Key
// header from process.env (read via lib/signatureapi/env) and exposes a small
// typed request helper plus the typed function signatures we will need as the
// NDA-gate feature is built out.
//
// SCOPE NOTE (NDA-gate chunk 1): this chunk only ships the nda_templates catalog
// + admin selection. Registering an NDA in the catalog is a Speevy-side record
// of a file the admin uploaded to the SignatureAPI Library by hand (SignatureAPI
// has no listable "template" resource), so no SignatureAPI call is required yet.
// The envelope / ceremony / deliverable functions are intentionally left as
// stubs with TODOs; they are implemented in the later "engine end-to-end" step.
//
// This module must never reach the browser: it reads the SignatureAPI secret.
// The runtime guard below fails loudly if it is ever bundled for the client.

import { getSignatureApiBaseUrl, getSignatureApiKey } from '@/lib/signatureapi/env';

if (typeof window !== 'undefined') {
  throw new Error('lib/signatureapi/client must only be imported on the server.');
}

export class SignatureApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SignatureApiError';
    this.status = status;
  }
}

type SignatureApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  // Plain JSON body; serialized by the helper. No PII should be logged here.
  body?: unknown;
  signal?: AbortSignal;
};

/**
 * Low-level authenticated request helper. Sets the X-API-Key header from the
 * server-side env and returns the parsed JSON body. Throws SignatureApiError on
 * a non-2xx response. Never logs the API key or response bodies (which may carry
 * LP PII) — callers decide what, if anything, is safe to surface.
 */
export async function signatureApiRequest<TResponse>(
  path: string,
  { method = 'GET', body, signal }: SignatureApiRequestOptions = {},
): Promise<TResponse> {
  const apiKey = getSignatureApiKey();

  if (!apiKey) {
    throw new SignatureApiError('SignatureAPI API key is not configured.', 0);
  }

  const url = `${getSignatureApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const response = await fetch(url, {
    method,
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    cache: 'no-store',
  });

  if (!response.ok) {
    // Deliberately do not include the response body in the error message; it can
    // contain envelope/recipient PII. The status is enough to act on + audit.
    throw new SignatureApiError(
      `SignatureAPI request failed with status ${response.status}.`,
      response.status,
    );
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}

// ---------------------------------------------------------------------------
// Typed function stubs for later steps (envelope creation, embedded ceremony,
// deliverable retrieval). Kept here so the call sites have a stable home; not
// implemented in this chunk. See docs/nda-gate-design.md §6.1 / §7.2.
// ---------------------------------------------------------------------------

export type CreateEnvelopeParams = {
  sourceFileUrl: string;
  recipientEmail: string;
  recipientName: string;
  embeddableInOrigin: string;
  // Echoed back on every webhook event so (lp, opportunity) maps without a lookup.
  metadata: { opportunity_id: string; lp_id: string };
};

export type CreatedEnvelope = {
  envelopeId: string;
  ceremonyUrl: string;
};

/**
 * TODO(nda-gate engine step): create a SignatureAPI envelope from a catalog
 * source file with the LP as recipient (delivery_type: none), whitelist the
 * Speevy origin via embeddable_in, attach envelope_metadata, and return the
 * recipient ceremony URL. Out of scope for the catalog chunk.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- stub for a later step
export async function createEnvelope(params: CreateEnvelopeParams): Promise<CreatedEnvelope> {
  throw new SignatureApiError('createEnvelope is not implemented yet.', 501);
}

/**
 * TODO(nda-gate webhook step): GET a deliverable to obtain the 1-hour pre-signed
 * URL for the sealed signed PDF + audit log. Out of scope for the catalog chunk.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- stub for a later step
export async function getDeliverable(deliverableId: string): Promise<never> {
  throw new SignatureApiError('getDeliverable is not implemented yet.', 501);
}
