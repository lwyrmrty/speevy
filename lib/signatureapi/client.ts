// lib/signatureapi/client.ts
//
// Server-only wrapper around the SignatureAPI REST API. Sets the X-API-Key
// header from process.env (read via lib/signatureapi/env) and exposes a small
// typed request helper plus the envelope / ceremony / deliverable calls the
// NDA-gate feature needs.
//
// This module must never reach the browser: it reads the SignatureAPI secret.
// The runtime guard below fails loudly if it is ever bundled for the client.
//
// SCOPE NOTE (Track 1B PR 1): createEnvelope is generalized so the SAME path
// serves both the account-level NDA (speevy_kind = 'account') and, later,
// per-opportunity NDAs (speevy_kind = 'opportunity'). Only account sending is
// wired in this PR; the opportunity sender UI lands in a later PR.
//
// Request/response shapes are modeled against SignatureAPI's documented
// Envelope / Recipient / Ceremony / Deliverable resources
// (https://signatureapi.com/docs/api). Only the fields we read/write are typed;
// unknown fields are ignored. See docs/nda-gate-design.md §3a / §6.1 / §7.2.

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
// Typed SignatureAPI resource shapes (only the fields we use).
// ---------------------------------------------------------------------------

/** Echoed back on every webhook event so (lp, opportunity) maps without a lookup. */
export type EnvelopeMetadata = Record<string, string>;

type SignatureApiCeremony = {
  // Direct ceremony URL — populated in the create response only when the
  // recipient uses `custom` authentication (which we use for embedded signing).
  url: string | null;
  embeddable_in: string[];
};

type SignatureApiRecipient = {
  id: string;
  key: string | null;
  type: string;
  status: string;
  ceremony?: SignatureApiCeremony | null;
};

type SignatureApiDeliverable = {
  id: string;
  envelope_id: string;
  status: string; // pending | generated | ...
  // 1-hour pre-signed URL to the sealed signed PDF; null until generated.
  url: string | null;
  generated_at: string | null;
};

export type SignatureApiEnvelope = {
  id: string;
  status: string; // processing | in_progress | completed | declined | expired | ...
  metadata?: EnvelopeMetadata | null;
  recipients: SignatureApiRecipient[];
  deliverable?: SignatureApiDeliverable | null;
};

// ---------------------------------------------------------------------------
// createEnvelope — create a SignatureAPI envelope from a catalog source file
// with the LP as recipient, delivery handled by us (delivery_type: none),
// the Speevy origin whitelisted for embedding, and our mapping keys attached as
// envelope_metadata. Returns the envelope + the recipient ceremony URL.
// ---------------------------------------------------------------------------

export type CreateEnvelopeParams = {
  // Internal title shown to the recipient in the ceremony.
  title: string;
  // SignatureAPI Library file URL (or stored-upload reference) from an
  // nda_templates row.
  sourceFileUrl: string;
  // Optional document format hint ('pdf' | 'docx'); SignatureAPI also infers it.
  documentFormat?: 'pdf' | 'docx';
  // {{place}} positions (signature/field anchors) carried by the catalog row's
  // fields_config. Passed through verbatim; SignatureAPI validates them.
  places?: unknown[];
  // {{merge}} data for DOCX templates carried by the catalog row's fields_config.
  documentData?: Record<string, unknown>;
  // The signer. For account NDAs this is the LP; for opportunity NDAs likewise.
  recipient: { name: string; email: string };
  // App origin allowed to embed the ceremony iframe (getAppOrigin() from lib/app-url).
  embeddableInOrigin: string;
  // Our mapping keys, e.g.
  //   { speevy_kind: 'account', lp_id }                          (account)
  //   { speevy_kind: 'opportunity', lp_id, opportunity_id }      (opportunity)
  metadata: EnvelopeMetadata;
};

export type CreatedEnvelope = {
  envelopeId: string;
  recipientId: string;
  // The embeddable ceremony URL; the client appends
  // `&embedded=true&event_delivery=message` when rendering the iframe.
  ceremonyUrl: string;
  deliverableId: string | null;
  status: string;
};

const SIGNER_KEY = 'signer';

export async function createEnvelope(params: CreateEnvelopeParams): Promise<CreatedEnvelope> {
  const {
    title,
    sourceFileUrl,
    documentFormat,
    places,
    documentData,
    recipient,
    embeddableInOrigin,
    metadata,
  } = params;

  const document: Record<string, unknown> = { url: sourceFileUrl };
  if (documentFormat) document.format = documentFormat;
  if (places && places.length > 0) document.places = places;
  if (documentData && Object.keys(documentData).length > 0) document.data = documentData;

  // SignatureAPI `custom` authentication requires a non-empty `data` object whose
  // key/value pairs are recorded in the envelope audit log to attest that Speevy
  // authenticated this recipient before issuing the ceremony URL. These values are
  // already known to SignatureAPI (recipient email) or are our own mapping keys.
  const authenticationData: Record<string, string> = {
    'Speevy Authenticated Email': recipient.email,
    'Authenticated At': new Date().toISOString(),
  };
  if (metadata.lp_id) authenticationData['LP ID'] = metadata.lp_id;
  if (metadata.speevy_kind) authenticationData['NDA Kind'] = metadata.speevy_kind;
  if (metadata.opportunity_id) authenticationData['Opportunity ID'] = metadata.opportunity_id;

  const body = {
    title,
    metadata,
    documents: [document],
    recipients: [
      {
        type: 'signer',
        key: SIGNER_KEY,
        name: recipient.name,
        email: recipient.email,
        // We distribute the signed deliverable ourselves (stored to Storage +
        // emailed in a later PR), so SignatureAPI must not auto-email it.
        delivery_type: 'none',
        ceremony: {
          // `custom` auth returns the ceremony URL directly in the create
          // response (vs `email_link`, where url is null until the link is used).
          authentication: [{ type: 'custom', provider: 'Speevy', data: authenticationData }],
          embeddable_in: [embeddableInOrigin],
        },
      },
    ],
  };

  const envelope = await signatureApiRequest<SignatureApiEnvelope>('/v1/envelopes', {
    method: 'POST',
    body,
  });

  const signer =
    envelope.recipients.find((r) => r.key === SIGNER_KEY) ?? envelope.recipients[0];
  const ceremonyUrl = signer?.ceremony?.url ?? null;

  if (!signer || !ceremonyUrl) {
    // With custom authentication the URL should be present. If it is not, fail
    // loudly rather than returning an unusable result. (Do not log the body.)
    throw new SignatureApiError(
      'SignatureAPI envelope created but no embeddable ceremony URL was returned.',
      502,
    );
  }

  return {
    envelopeId: envelope.id,
    recipientId: signer.id,
    ceremonyUrl,
    deliverableId: envelope.deliverable?.id ?? null,
    status: envelope.status,
  };
}

// ---------------------------------------------------------------------------
// getDeliverable — fetch a deliverable so the webhook can obtain the 1-hour
// pre-signed URL to the sealed signed PDF + audit log. Accepts a deliverable id.
// ---------------------------------------------------------------------------

export type Deliverable = {
  id: string;
  envelopeId: string;
  status: string;
  url: string | null;
  generatedAt: string | null;
};

export async function getDeliverable(deliverableId: string): Promise<Deliverable> {
  const deliverable = await signatureApiRequest<SignatureApiDeliverable>(
    `/v1/deliverables/${encodeURIComponent(deliverableId)}`,
  );

  return {
    id: deliverable.id,
    envelopeId: deliverable.envelope_id,
    status: deliverable.status,
    url: deliverable.url,
    generatedAt: deliverable.generated_at,
  };
}

// ---------------------------------------------------------------------------
// getEnvelope — fetch an envelope (used by the webhook to read the current
// deliverable id/url when an event does not carry it inline).
// ---------------------------------------------------------------------------

export async function getEnvelope(envelopeId: string): Promise<SignatureApiEnvelope> {
  return signatureApiRequest<SignatureApiEnvelope>(
    `/v1/envelopes/${encodeURIComponent(envelopeId)}`,
  );
}

// ---------------------------------------------------------------------------
// downloadDeliverablePdf — fetch the sealed PDF bytes from the deliverable's
// pre-signed URL (a short-lived storage URL; not the API host, so no API key is
// attached and nothing here is logged). The webhook uploads these bytes to a
// private Supabase Storage bucket.
// ---------------------------------------------------------------------------

export async function downloadDeliverablePdf(presignedUrl: string): Promise<ArrayBuffer> {
  const response = await fetch(presignedUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new SignatureApiError(
      `Failed to download signed NDA deliverable (status ${response.status}).`,
      response.status,
    );
  }
  return response.arrayBuffer();
}
