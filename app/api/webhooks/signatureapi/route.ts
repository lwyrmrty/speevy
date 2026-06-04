import { NextResponse } from 'next/server';
import { Webhook, WebhookVerificationError } from 'standardwebhooks';

import {
  downloadDeliverablePdf,
  getDeliverable,
  getEnvelope,
  SignatureApiError,
} from '@/lib/signatureapi/client';
import { getSignatureApiWebhookSecret } from '@/lib/signatureapi/env';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

// SignatureAPI completion webhook (Track 1B PR 1).
//
// Verifies the Standard Webhooks HMAC signature, dedupes on the event id, then
// routes by the persisted envelope_id (defense-in-depth vs envelope_metadata)
// to update either account_ndas (speevy_kind 'account') or opportunity_ndas
// ('opportunity'). On completion it flips status to 'signed' + writes an
// `nda.signed` audit row; on deliverable.generated it downloads the sealed PDF
// and stores it in the private `nda-documents` Storage bucket.
//
// Service-role use is allowed here: it happens ONLY after signature
// verification. No secret, signer email, or other PII is logged.
//
// TODO(next UX PR — email): after a row reaches 'signed' and its PDF is stored,
// trigger the Loops "your signed NDA" email (link to a tokenized download
// route). Intentionally not wired in this PR.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROVIDER = 'signatureapi';
const STORAGE_BUCKET = 'nda-documents';

type NdaTier = 'account' | 'opportunity';

type WebhookEnvelope = {
  type?: string;
  data?: Record<string, unknown> | null;
};

// Maps a SignatureAPI event type to the lifecycle effect we apply.
type LifecycleEffect = 'signed' | 'viewed' | 'declined' | 'expired' | 'deliverable' | 'ignore';

function classifyEvent(type: string | undefined): LifecycleEffect {
  switch (type) {
    // Keyed on the all-signers event so countersignature stays non-breaking;
    // recipient.completed coincides with envelope.completed for a single signer.
    case 'recipient.completed':
    case 'envelope.completed':
      return 'signed';
    case 'recipient.opened':
    case 'recipient.viewed':
    case 'envelope.in_progress':
      return 'viewed';
    case 'recipient.declined':
    case 'envelope.declined':
    case 'envelope.canceled':
    case 'envelope.cancelled':
      return 'declined';
    case 'envelope.expired':
      return 'expired';
    case 'deliverable.generated':
      return 'deliverable';
    default:
      return 'ignore';
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

// Resolve the envelope id from whichever object the event carries (the envelope
// itself, a recipient, or a deliverable).
function extractEnvelopeId(data: Record<string, unknown> | null, type: string | undefined): string | null {
  if (!data) return null;
  const direct = asString(data.envelope_id);
  if (direct) return direct;
  // For envelope.* events `data` is the envelope, whose own id is the envelope id.
  if (type?.startsWith('envelope.')) {
    const id = asString(data.id);
    if (id) return id;
  }
  const nested = asRecord(data.envelope);
  return nested ? asString(nested.id) : null;
}

function extractDeliverableId(data: Record<string, unknown> | null): string | null {
  if (!data) return null;
  // deliverable.generated → data is the deliverable, whose id is a `del_…`.
  const id = asString(data.id);
  if (id && id.startsWith('del_')) return id;
  const nested = asRecord(data.deliverable);
  return nested ? asString(nested.id) : null;
}

export async function POST(request: Request) {
  const secret = getSignatureApiWebhookSecret();
  if (!secret) {
    // Fail closed. Never log the secret value (there is none here to log).
    console.error('SignatureAPI webhook rejected: SIGNATUREAPI_WEBHOOK_SECRET is not configured.');
    return NextResponse.json({ message: 'Webhook not configured.' }, { status: 500 });
  }

  const rawBody = await request.text();
  const headers = {
    'webhook-id': request.headers.get('webhook-id') ?? '',
    'webhook-timestamp': request.headers.get('webhook-timestamp') ?? '',
    'webhook-signature': request.headers.get('webhook-signature') ?? '',
  };

  let payload: WebhookEnvelope;
  try {
    const wh = new Webhook(secret);
    payload = wh.verify(rawBody, headers) as WebhookEnvelope;
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      return NextResponse.json({ message: 'Invalid signature.' }, { status: 401 });
    }
    return NextResponse.json({ message: 'Invalid webhook payload.' }, { status: 400 });
  }

  const eventId = headers['webhook-id'] || null;
  const eventType = typeof payload.type === 'string' ? payload.type : undefined;
  const data = asRecord(payload.data);
  const envelopeId = extractEnvelopeId(data, eventType);

  const supabase = createSupabaseAdminClient();

  // Idempotency anchor: insert keyed on (provider, provider_event_id). A unique
  // violation means we already processed this delivery → ack and no-op.
  const scrubbedPayload = { type: eventType ?? null, envelope_id: envelopeId };
  const { data: eventRow, error: eventInsertError } = await supabase
    .from('nda_webhook_events')
    .insert({
      provider: PROVIDER,
      provider_event_id: eventId,
      event_type: eventType ?? null,
      status: 'received',
      raw_payload: scrubbedPayload,
    })
    .select('id')
    .single();

  if (eventInsertError) {
    // 23505 = unique_violation → duplicate delivery.
    if (eventInsertError.code === '23505') {
      return NextResponse.json({ message: 'Duplicate event ignored.' }, { status: 200 });
    }
    console.error('SignatureAPI webhook: failed to record event.');
    return NextResponse.json({ message: 'Could not record event.' }, { status: 500 });
  }

  const effect = classifyEvent(eventType);

  if (!envelopeId || effect === 'ignore') {
    await supabase
      .from('nda_webhook_events')
      .update({ status: envelopeId ? 'applied' : 'unmatched' })
      .eq('id', eventRow.id);
    return NextResponse.json({ message: 'Acknowledged.' }, { status: 200 });
  }

  // Route by the persisted envelope_id. Account tier first, then opportunity.
  const { data: accountRow } = await supabase
    .from('account_ndas')
    .select('id, lp_id, status, signed_document_storage_key')
    .eq('envelope_id', envelopeId)
    .maybeSingle();

  let tier: NdaTier | null = accountRow ? 'account' : null;
  let rowId = accountRow?.id ?? null;
  let currentStatus = accountRow?.status ?? null;

  if (!tier) {
    const { data: opportunityRow } = await supabase
      .from('opportunity_ndas')
      .select('id, lp_id, status, signed_document_storage_key')
      .eq('envelope_id', envelopeId)
      .maybeSingle();
    if (opportunityRow) {
      tier = 'opportunity';
      rowId = opportunityRow.id;
      currentStatus = opportunityRow.status;
    }
  }

  if (!tier || !rowId) {
    await supabase.from('nda_webhook_events').update({ status: 'unmatched' }).eq('id', eventRow.id);
    return NextResponse.json({ message: 'Acknowledged (no matching NDA).' }, { status: 200 });
  }

  const table = tier === 'account' ? 'account_ndas' : 'opportunity_ndas';
  const now = new Date().toISOString();

  try {
    if (effect === 'deliverable') {
      await handleDeliverable({ supabase, table, rowId, tier, data, envelopeId });
    } else if (effect === 'signed') {
      await applyStatusUpdate({
        supabase,
        table,
        rowId,
        currentStatus,
        eventId,
        updates: { status: 'signed', signed_at: now },
      });
      await writeSignedAudit({ supabase, tier, rowId, envelopeId });
    } else if (effect === 'viewed') {
      // Never downgrade a signed row.
      if (currentStatus === 'sent') {
        await applyStatusUpdate({
          supabase,
          table,
          rowId,
          currentStatus,
          eventId,
          updates: { status: 'viewed' },
        });
      }
    } else if (effect === 'declined') {
      if (currentStatus !== 'signed') {
        // opportunity_ndas has no declined_at column (account_ndas does).
        const updates =
          table === 'account_ndas' ? { status: 'declined', declined_at: now } : { status: 'declined' };
        await applyStatusUpdate({ supabase, table, rowId, currentStatus, eventId, updates });
      }
    } else if (effect === 'expired') {
      if (currentStatus !== 'signed') {
        // opportunity_ndas has no expired_at column (account_ndas does).
        const updates =
          table === 'account_ndas' ? { status: 'expired', expired_at: now } : { status: 'expired' };
        await applyStatusUpdate({ supabase, table, rowId, currentStatus, eventId, updates });
      }
    }
  } catch (error) {
    // Do not leak provider/PII detail. Return 500 so SignatureAPI retries.
    const message = error instanceof SignatureApiError ? `signatureapi:${error.status}` : 'processing_error';
    console.error(`SignatureAPI webhook processing failed (${message}).`);
    await supabase.from('nda_webhook_events').update({ status: 'received' }).eq('id', eventRow.id);
    return NextResponse.json({ message: 'Processing failed.' }, { status: 500 });
  }

  await supabase
    .from('nda_webhook_events')
    .update({
      status: 'applied',
      account_nda_id: tier === 'account' ? rowId : null,
      opportunity_nda_id: tier === 'opportunity' ? rowId : null,
    })
    .eq('id', eventRow.id);

  return NextResponse.json({ message: 'Processed.' }, { status: 200 });
}

type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

async function applyStatusUpdate(args: {
  supabase: SupabaseAdmin;
  table: 'account_ndas' | 'opportunity_ndas';
  rowId: string;
  currentStatus: string | null;
  eventId: string | null;
  updates: Record<string, unknown>;
}): Promise<void> {
  const { supabase, table, rowId, eventId, updates } = args;
  const patch: Record<string, unknown> = { ...updates };
  // opportunity_ndas has no updated_at / last_webhook_event_id columns; only set
  // those on account_ndas.
  if (table === 'account_ndas') {
    patch.updated_at = new Date().toISOString();
    if (eventId) patch.last_webhook_event_id = eventId;
  }
  const { error } = await supabase.from(table).update(patch).eq('id', rowId);
  if (error) {
    throw new Error('status_update_failed');
  }
}

async function writeSignedAudit(args: {
  supabase: SupabaseAdmin;
  tier: NdaTier;
  rowId: string;
  envelopeId: string;
}): Promise<void> {
  const { supabase, tier, rowId, envelopeId } = args;
  await supabase.from('audit_log').insert({
    actor_profile_id: null,
    actor_role: null,
    action: 'nda.signed',
    entity_type: tier === 'account' ? 'account_nda' : 'opportunity_nda',
    entity_id: tier === 'opportunity' ? rowId : null,
    metadata: { kind: tier, envelope_id: envelopeId },
  });
}

async function handleDeliverable(args: {
  supabase: SupabaseAdmin;
  table: 'account_ndas' | 'opportunity_ndas';
  rowId: string;
  tier: NdaTier;
  data: Record<string, unknown> | null;
  envelopeId: string;
}): Promise<void> {
  const { supabase, table, rowId, tier, data, envelopeId } = args;

  // Resolve the deliverable id (from the event) and its 1-hour pre-signed URL.
  let deliverableId = extractDeliverableId(data);
  let url = data ? asString(data.url) : null;

  if (!url) {
    if (!deliverableId) {
      const envelope = await getEnvelope(envelopeId);
      deliverableId = envelope.deliverable?.id ?? null;
      url = envelope.deliverable?.url ?? null;
    }
    if (!url && deliverableId) {
      const deliverable = await getDeliverable(deliverableId);
      url = deliverable.url;
    }
  }

  if (!url) {
    // Deliverable not ready yet; SignatureAPI will re-deliver. Treat as transient.
    throw new Error('deliverable_url_unavailable');
  }

  const pdf = await downloadDeliverablePdf(url);
  const storageKey = `${tier}/${rowId}/${envelopeId}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storageKey, Buffer.from(pdf), {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    throw new Error('storage_upload_failed');
  }

  const patch: Record<string, unknown> = { signed_document_storage_key: storageKey };
  if (table === 'account_ndas') {
    patch.updated_at = new Date().toISOString();
  }
  const { error: updateError } = await supabase.from(table).update(patch).eq('id', rowId);
  if (updateError) {
    throw new Error('storage_key_update_failed');
  }
}
