'use server';

import { z } from 'zod';

import { cookies } from 'next/headers';

import { getAccountDefaultNdaTemplate } from '@/lib/nda/account-default';
import { verifyNdaOnboardingToken } from '@/lib/nda/tokens';
import {
  opportunityAccessCookieName,
  verifyOpportunityAccessToken,
} from '@/lib/opportunity-access';
import {
  createEnvelope,
  getEnvelope,
  SignatureApiError,
  type EnvelopeMetadata,
} from '@/lib/signatureapi/client';
import { hasSignatureApiEnv } from '@/lib/signatureapi/env';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// Account-level NDA envelope creation (Track 1B PR 1 — backend spine).
//
// Resolves the account-default nda_templates row, creates a SignatureAPI
// envelope (delivery_type: none, embeddable in the app origin, metadata
// { speevy_kind: 'account', lp_id }), upserts an account_ndas row (status
// 'sent') via the service role (RLS has no insert policy on account_ndas), and
// returns the embeddable ceremony URL. Writes an `nda.sent` audit row.
//
// The same envelope-creation path is generalized in lib/signatureapi/client so
// per-opportunity NDA sending can reuse it later (speevy_kind: 'opportunity').
//
// The tokenized onboarding entry point (getAccountNdaCeremonyForOnboardingToken)
// resolves the lp_id from a signed, expiring token (the lead has no auth session
// yet); the outsider entry point (getAccountNdaCeremonyForOutsider) resolves the
// lp_id from the opportunity access cookie's email. Both reuse the shared
// `ensureAccountNdaEnvelope` helper below. See docs/nda-gate-design.md §4B.5.

export type AccountNdaEnvelopeResult =
  | { status: 'success'; ceremonyUrl: string; ndaStatus: string }
  | { status: 'already_signed'; message: string }
  | { status: 'skipped'; message: string }
  | { status: 'error'; message: string };

const SIGNABLE_REUSE_STATUSES = new Set(['sent', 'viewed']);

function getAppOrigin(): string {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://speevy.vc').replace(/\/$/, '');
  try {
    return new URL(appUrl).origin;
  } catch {
    return 'https://speevy.vc';
  }
}

type EnvelopeDocConfig = {
  documentFormat?: 'pdf' | 'docx';
  places?: unknown[];
  documentData?: Record<string, unknown>;
};

// Pull the optional SignatureAPI document config out of an nda_templates
// fields_config blob without trusting its shape.
function readDocConfig(fieldsConfig: Record<string, unknown>): EnvelopeDocConfig {
  const config: EnvelopeDocConfig = {};
  const format = fieldsConfig.documentFormat ?? fieldsConfig.format;
  if (format === 'pdf' || format === 'docx') config.documentFormat = format;
  if (Array.isArray(fieldsConfig.places)) config.places = fieldsConfig.places;
  if (fieldsConfig.data && typeof fieldsConfig.data === 'object') {
    config.documentData = fieldsConfig.data as Record<string, unknown>;
  }
  return config;
}

type ActorContext = {
  profileId: string | null;
  role: 'admin' | 'lp' | null;
};

type AccountNdaLp = {
  id: string;
  email: string;
  fullName: string | null;
};

/**
 * Shared core: ensure an account NDA envelope exists for the given LP and return
 * its embeddable ceremony URL. Caller MUST have authorized the request (session
 * LP, admin, onboarding token, or outsider cookie). Uses the service role for
 * the account_ndas write because RLS intentionally has no insert/update policy.
 */
async function ensureAccountNdaEnvelope(
  lp: AccountNdaLp,
  actor: ActorContext,
): Promise<AccountNdaEnvelopeResult> {
  if (!hasSignatureApiEnv()) {
    return { status: 'error', message: 'SignatureAPI is not configured.' };
  }

  const template = await getAccountDefaultNdaTemplate();
  if (!template) {
    // Fail-safe: the account NDA is informational and must never block the LP.
    return {
      status: 'skipped',
      message: 'No account-default NDA template is configured.',
    };
  }

  const supabase = createSupabaseAdminClient();

  const { data: existing } = await supabase
    .from('account_ndas')
    .select('id, envelope_id, status')
    .eq('lp_id', lp.id)
    .maybeSingle();

  if (existing?.status === 'signed') {
    return { status: 'already_signed', message: 'This investor has already signed the account NDA.' };
  }

  // Reuse a non-terminal envelope when we can recover its ceremony URL.
  if (existing && SIGNABLE_REUSE_STATUSES.has(existing.status)) {
    try {
      const envelope = await getEnvelope(existing.envelope_id);
      const url = envelope.recipients.find((r) => r.ceremony?.url)?.ceremony?.url ?? null;
      if (url) {
        return { status: 'success', ceremonyUrl: url, ndaStatus: existing.status };
      }
    } catch (error) {
      if (!(error instanceof SignatureApiError)) throw error;
      // Fall through to creating a fresh envelope below.
    }
  }

  const docConfig = readDocConfig(template.fieldsConfig);
  const metadata: EnvelopeMetadata = { speevy_kind: 'account', lp_id: lp.id };

  let created;
  try {
    created = await createEnvelope({
      title: template.name,
      sourceFileUrl: template.sourceFileUrl,
      documentFormat: docConfig.documentFormat,
      places: docConfig.places,
      documentData: docConfig.documentData,
      recipient: { name: lp.fullName?.trim() || lp.email, email: lp.email },
      embeddableInOrigin: getAppOrigin(),
      metadata,
    });
  } catch (error) {
    if (error instanceof SignatureApiError) {
      // Do not surface PII-bearing provider detail; status is enough to act on.
      return { status: 'error', message: 'Could not start the NDA signing ceremony.' };
    }
    throw error;
  }

  const now = new Date().toISOString();
  const row = {
    lp_id: lp.id,
    nda_template_id: template.id,
    signature_provider: template.signatureProvider || 'signatureapi',
    envelope_id: created.envelopeId,
    status: 'sent' as const,
    sent_at: now,
    signed_at: null,
    declined_at: null,
    expired_at: null,
    updated_at: now,
  };

  // Service-role write: account_ndas has no insert/update RLS policy by design
  // (webhook + this onboarding action are the only writers). unique(lp_id) keeps
  // it to one row per investor; on re-send (declined/expired) we overwrite it.
  const { error: upsertError } = await supabase
    .from('account_ndas')
    .upsert(row, { onConflict: 'lp_id' });

  if (upsertError) {
    return { status: 'error', message: 'Could not record the NDA. Please try again.' };
  }

  await supabase.from('audit_log').insert({
    actor_profile_id: actor.profileId,
    actor_role: actor.role,
    action: 'nda.sent',
    entity_type: 'account_nda',
    entity_id: null,
    metadata: {
      kind: 'account',
      lp_id: lp.id,
      nda_template_id: template.id,
      envelope_id: created.envelopeId,
    },
  });

  return { status: 'success', ceremonyUrl: created.ceremonyUrl, ndaStatus: created.status };
}

/**
 * Session-LP self-service entry point: resolve the caller's lp row and ensure
 * their account NDA envelope, returning the ceremony URL to embed.
 */
export async function getAccountNdaCeremonyUrl(): Promise<AccountNdaEnvelopeResult> {
  const serverSupabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    return { status: 'error', message: 'Sign in to review and sign your account NDA.' };
  }

  const supabase = createSupabaseAdminClient();
  const { data: lp } = await supabase
    .from('lps')
    .select('id, email, full_name')
    .eq('profile_id', user.id)
    .maybeSingle();

  if (!lp) {
    return { status: 'error', message: 'No investor profile is associated with this account.' };
  }

  return ensureAccountNdaEnvelope(
    { id: lp.id, email: lp.email, fullName: lp.full_name },
    { profileId: user.id, role: 'lp' },
  );
}

const createAccountNdaEnvelopeSchema = z.object({
  lpId: z.string().uuid(),
});

/**
 * Admin-initiated entry point: create/ensure the account NDA envelope for a
 * specific LP. First line validates admin role. Returns the ceremony URL (the
 * admin UX that surfaces it lands in a later PR).
 */
export async function createAccountNdaEnvelopeForLp(
  payload: z.input<typeof createAccountNdaEnvelopeSchema>,
): Promise<AccountNdaEnvelopeResult> {
  const serverSupabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    return { status: 'error', message: 'Sign in as an admin to send an account NDA.' };
  }

  const supabase = createSupabaseAdminClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    return { status: 'error', message: 'Only admins can send an account NDA on behalf of an investor.' };
  }

  const parsed = createAccountNdaEnvelopeSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 'error', message: 'Select a valid investor.' };
  }

  const { data: lp } = await supabase
    .from('lps')
    .select('id, email, full_name')
    .eq('id', parsed.data.lpId)
    .maybeSingle();

  if (!lp) {
    return { status: 'error', message: 'That investor could not be found.' };
  }

  return ensureAccountNdaEnvelope(
    { id: lp.id, email: lp.email, fullName: lp.full_name },
    { profileId: user.id, role: 'admin' },
  );
}

/**
 * Onboarding entry point (no auth session): resolve the lp_id from a signed,
 * expiring onboarding token and ensure their account NDA envelope. Used by the
 * tokenized /onboarding/nda page right after the join form. Token verification
 * is the authorization here — it proves the holder created this exact lead.
 * Uses the service role to read the lp because the lead has no session/profile.
 */
export async function getAccountNdaCeremonyForOnboardingToken(
  token: string | undefined,
): Promise<AccountNdaEnvelopeResult> {
  const lpId = verifyNdaOnboardingToken(token);
  if (!lpId) {
    return { status: 'error', message: 'This NDA link is invalid or has expired.' };
  }

  const supabase = createSupabaseAdminClient();
  const { data: lp } = await supabase
    .from('lps')
    .select('id, email, full_name')
    .eq('id', lpId)
    .maybeSingle();

  if (!lp) {
    return { status: 'error', message: 'We could not find your investor record.' };
  }

  // No profile yet for a pending lead, so the actor profile id is null. The
  // audit row still records lp_id + envelope in its metadata.
  return ensureAccountNdaEnvelope(
    { id: lp.id, email: lp.email, fullName: lp.full_name },
    { profileId: null, role: 'lp' },
  );
}

/**
 * Outsider entry point (no auth session): resolve the lp_id from the
 * opportunity access cookie's verified email and ensure their account NDA
 * envelope. Surfaced once on a password-gated opportunity the outsider has
 * unlocked. The signed, opportunity-scoped cookie is the authorization.
 */
export async function getAccountNdaCeremonyForOutsider(
  opportunityId: string,
): Promise<AccountNdaEnvelopeResult> {
  if (!z.string().uuid().safeParse(opportunityId).success) {
    return { status: 'error', message: 'Unable to load your account NDA.' };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(opportunityAccessCookieName(opportunityId))?.value;
  const email = verifyOpportunityAccessToken(token, opportunityId);

  if (!email) {
    return { status: 'error', message: 'Unlock this opportunity before signing the NDA.' };
  }

  const supabase = createSupabaseAdminClient();
  const { data: lp } = await supabase
    .from('lps')
    .select('id, email, full_name')
    .eq('email', email)
    .maybeSingle();

  if (!lp) {
    // The outsider lps row is created when access is granted; if it is missing
    // we skip cleanly rather than error (the NDA is informational).
    return { status: 'skipped', message: 'No investor record is associated with this access yet.' };
  }

  return ensureAccountNdaEnvelope(
    { id: lp.id, email: lp.email, fullName: lp.full_name },
    { profileId: null, role: 'lp' },
  );
}
