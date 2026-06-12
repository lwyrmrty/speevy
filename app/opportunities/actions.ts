'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { buildAppUrl } from '@/lib/app-url';
import {
  hasLoopsAdminInterestEnv,
  hasLoopsLoginCodeEnv,
  sendAdminInterestEmail,
  sendLoginCodeEmail,
} from '@/lib/loops/transactional';
import {
  createOpportunityAccessToken,
  createOpportunityVerifiedToken,
  isOpportunityVerifiedTokenValid,
  opportunityAccessCookieName,
  opportunityVerifiedCookieName,
  verifyOpportunityAccessToken,
  OPPORTUNITY_VERIFIED_TTL_MS,
} from '@/lib/opportunity-access';
import { opportunityPasswordMatches } from '@/lib/opportunity-password';
import {
  GATE_CODE_EMAIL_WINDOW_SECONDS,
  GATE_CODE_IP_WINDOW_SECONDS,
  GATE_CODE_MAX_PER_EMAIL,
  GATE_CODE_MAX_PER_IP,
  GATE_PASSWORD_MAX_ATTEMPTS,
  GATE_PASSWORD_WINDOW_SECONDS,
  gateRateLimitExceeded,
  getClientIp,
  incrementGateRateLimit,
} from '@/lib/opportunity-rate-limit';
import {
  generateVerificationCode,
  hashVerificationCode,
  verificationCodeMatches,
  VERIFICATION_MAX_ATTEMPTS,
  VERIFICATION_TTL_MS,
} from '@/lib/opportunity-verification';
import {
  centsToNumber,
  getOpportunityInterestTotals,
} from '@/lib/opportunity-interest-summary';
import { notifySlackInvestorJoined } from '@/lib/slack/notifications';
import { notifyZapierOpportunityInterest } from '@/lib/zapier/notifications';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const saveInterestSchema = z.object({
  opportunityId: z.string().uuid(),
  amountCents: z.number().int().positive().nullable(),
  interested: z.boolean(),
});

// Gate submission: First/Last name + email + the admin-chosen opportunity
// password. Names feed the outsider-LP `full_name`; email is the identity we
// upsert by and verify.
const requestAccessSchema = z.object({
  slug: z.string().trim().min(1),
  password: z.string().min(1),
  email: z.string().trim().toLowerCase().email(),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
});

// Code submission: the same gate fields plus the 6-digit emailed code.
const verifyAccessSchema = requestAccessSchema.extend({
  code: z.string().trim().regex(/^\d{6}$/),
});

type AdminSupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

const SHAREABLE_STATUSES = ['active', 'potential', 'coming_soon', 'closed'];

const AMOUNT_REQUIRED_STATUSES = ['active', 'potential', 'coming_soon'];

// Generic, non-revealing throttle response. It must not disclose whether the
// password was correct or whether the slug/email exists — only that the caller
// should slow down.
const GATE_THROTTLED_MESSAGE = 'Too many attempts. Please try again in a few minutes.';

export type RequestOpportunityAccessResult =
  | { status: 'granted'; slug: string }
  | { status: 'code_sent' }
  | { status: 'error'; message: string };

export type VerifyOpportunityAccessResult =
  | { status: 'granted'; slug: string }
  | { status: 'error'; message: string };

// Find an existing LP by email or create a lightweight "outsider" LP row for a
// visitor who unlocked a password-protected opportunity. Outsiders have no auth
// user (profile_id stays null) and no invitation; their email is the only
// identity we have. We never downgrade an existing LP (e.g. an approved
// insider) who happens to reuse the same email here.
//
// `fullName` (when provided, e.g. from the gate's first/last name fields) is
// stored in the same `full_name` column insiders use, so outsider leads match
// our insider records better. It is only written when it is a non-empty value
// that differs from what's stored — we never clobber an existing name with a
// blank (e.g. the interest path, where no name is collected).
async function findOrCreateOutsiderLp(
  supabase: AdminSupabaseClient,
  email: string,
  fullName?: string | null,
) {
  const trimmedName = fullName?.trim() ?? '';

  const { data: existing } = await supabase
    .from('lps')
    .select('id, email, full_name, status')
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    if (trimmedName && trimmedName !== (existing.full_name ?? '')) {
      const { data: updated } = await supabase
        .from('lps')
        .update({ full_name: trimmedName, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select('id, email, full_name, status')
        .single();

      if (updated) {
        return { lp: updated, created: false, error: null as string | null };
      }
    }

    return { lp: existing, created: false, error: null as string | null };
  }

  const { data: created, error } = await supabase
    .from('lps')
    .insert({ email, status: 'outsider', full_name: trimmedName || null })
    .select('id, email, full_name, status')
    .single();

  if (error || !created) {
    return { lp: null, created: false, error: error?.message ?? 'Could not record your access.' };
  }

  return { lp: created, created: true, error: null as string | null };
}

type AdminInterestNotification = {
  amountCents: number | null;
  indicatedAt: string;
  investorEmail: string;
  investorName: string;
  opportunityId: string;
  opportunitySlug: string;
  opportunityTitle: string;
  recipientEmail: string;
};

export type SaveOpportunityInterestResult =
  | { status: 'success' }
  | { status: 'error'; message: string };

function formatInterestAmount(amountCents: number | null) {
  if (amountCents === null) {
    return 'No amount shared';
  }

  return (amountCents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

async function sendAdminInterestNotification({
  amountCents,
  indicatedAt,
  investorEmail,
  investorName,
  opportunityId,
  opportunitySlug,
  opportunityTitle,
  recipientEmail,
}: AdminInterestNotification) {
  if (!recipientEmail || !hasLoopsAdminInterestEnv()) {
    return;
  }

  await sendAdminInterestEmail({
    adminInterestUrl: buildAppUrl(`/admin/opportunities/${opportunitySlug}/interest`),
    amount: formatInterestAmount(amountCents),
    email: recipientEmail,
    indicatedAt,
    investorEmail,
    investorName,
    opportunityTitle,
    opportunityUrl: buildAppUrl(`/opportunities/${opportunitySlug}`),
    idempotencyKey: `interest-${opportunityId}-${recipientEmail}-${indicatedAt}`,
  });
}

type InterestLp = {
  id: string;
  email: string;
  full_name: string | null;
};

type InterestOpportunity = {
  id: string;
  slug: string;
  title: string;
  target_allocation_cents: number | string | null;
};

// Shared "record this LP's interest in this opportunity" path. Callers are
// responsible for authorization (an authed approved LP, or an outsider who has
// unlocked a password-protected opportunity). This performs the upsert, audit
// log row, admin notifications, and revalidation.
async function persistInterest(
  supabase: AdminSupabaseClient,
  {
    opportunity,
    lp,
    amountCents,
    actorProfileId,
    source,
  }: {
    opportunity: InterestOpportunity;
    lp: InterestLp;
    amountCents: number | null;
    actorProfileId: string | null;
    source: 'lp' | 'password_gate';
  },
): Promise<SaveOpportunityInterestResult> {
  const indicatedAt = new Date().toISOString();
  const { data: existingInterest } = await supabase
    .from('interests')
    .select('id')
    .eq('opportunity_id', opportunity.id)
    .eq('lp_id', lp.id)
    .neq('status', 'withdrawn')
    .maybeSingle();
  const isUpdate = Boolean(existingInterest);

  const { error } = await supabase
    .from('interests')
    .upsert(
      {
        opportunity_id: opportunity.id,
        lp_id: lp.id,
        status: 'indicated',
        amount_cents: amountCents,
        indicated_at: indicatedAt,
        withdrawn_at: null,
      },
      { onConflict: 'opportunity_id,lp_id' },
    );

  if (error) {
    return { status: 'error', message: 'Unable to save interest. Please try again.' };
  }

  await supabase.from('audit_log').insert({
    actor_profile_id: actorProfileId,
    actor_role: 'lp',
    action: 'interest.indicated',
    entity_type: 'opportunity',
    entity_id: opportunity.id,
    metadata: {
      amount_cents: amountCents,
      lp_id: lp.id,
      source,
    },
  });

  const { data: admins } = await supabase
    .from('profiles')
    .select('email')
    .eq('role', 'admin');
  await Promise.allSettled(
    (admins ?? []).map((admin) =>
      sendAdminInterestNotification({
        amountCents,
        indicatedAt,
        investorEmail: lp.email,
        investorName: lp.full_name || lp.email,
        opportunityId: opportunity.id,
        opportunitySlug: opportunity.slug,
        opportunityTitle: opportunity.title,
        recipientEmail: admin.email,
      }),
    ),
  );

  const { investorCount, totalInterestCents } = await getOpportunityInterestTotals(
    supabase,
    opportunity.id,
  );
  const targetAllocationCents = centsToNumber(opportunity.target_allocation_cents);

  await notifyZapierOpportunityInterest({
    investorName: lp.full_name || lp.email,
    investorEmail: lp.email,
    opportunityTitle: opportunity.title,
    opportunitySlug: opportunity.slug,
    amountLabel: formatInterestAmount(amountCents),
    indicatedAt,
    source,
    isUpdate,
    investorCount,
    totalInterestCents,
    targetAllocationCents: targetAllocationCents > 0 ? targetAllocationCents : null,
  });

  revalidatePath('/opportunities');
  revalidatePath(`/opportunities/${opportunity.slug}`);

  return { status: 'success' };
}

async function persistWithdrawal(
  supabase: AdminSupabaseClient,
  {
    opportunity,
    lp,
    actorProfileId,
    source,
  }: {
    opportunity: InterestOpportunity;
    lp: InterestLp;
    actorProfileId: string | null;
    source: 'lp' | 'password_gate';
  },
): Promise<SaveOpportunityInterestResult> {
  const withdrawnAt = new Date().toISOString();
  const { data: existingInterest, error: lookupError } = await supabase
    .from('interests')
    .select('id')
    .eq('opportunity_id', opportunity.id)
    .eq('lp_id', lp.id)
    .is('withdrawn_at', null)
    .maybeSingle();

  if (lookupError) {
    return { status: 'error', message: 'Unable to withdraw interest. Please try again.' };
  }

  if (!existingInterest) {
    return { status: 'error', message: 'No interest to withdraw.' };
  }

  const { error } = await supabase
    .from('interests')
    .update({
      status: 'withdrawn',
      withdrawn_at: withdrawnAt,
    })
    .eq('id', existingInterest.id);

  if (error) {
    return { status: 'error', message: 'Unable to withdraw interest. Please try again.' };
  }

  await supabase.from('audit_log').insert({
    actor_profile_id: actorProfileId,
    actor_role: 'lp',
    action: 'interest.withdrawn',
    entity_type: 'opportunity',
    entity_id: opportunity.id,
    metadata: {
      lp_id: lp.id,
      source,
    },
  });

  revalidatePath('/opportunities');
  revalidatePath(`/opportunities/${opportunity.slug}`);

  return { status: 'success' };
}

// Outsider path: a visitor with a valid (signed, opportunity-scoped) access
// cookie submits interest on a password-protected opportunity. Their identity
// is the email they entered at the gate, stored on an "outsider" LP row.
async function saveGuestOpportunityInterest(
  opportunityId: string,
  amountCents: number | null,
  interested: boolean,
): Promise<SaveOpportunityInterestResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(opportunityAccessCookieName(opportunityId))?.value;
  const email = verifyOpportunityAccessToken(token, opportunityId);

  if (!email) {
    return { status: 'error', message: 'Unlock this opportunity before reserving interest.' };
  }

  const supabase = createSupabaseAdminClient();
  const { data: opportunity } = await supabase
    .from('opportunities')
    .select('id, slug, title, status, published_at, password_protected, target_allocation_cents')
    .eq('id', opportunityId)
    .maybeSingle();

  if (
    !opportunity
    || !opportunity.password_protected
    || opportunity.published_at === null
    || !SHAREABLE_STATUSES.includes(opportunity.status)
  ) {
    return { status: 'error', message: 'This opportunity is not currently accepting interest.' };
  }

  const { lp, error } = await findOrCreateOutsiderLp(supabase, email);

  if (error || !lp) {
    return { status: 'error', message: error ?? 'Unable to save interest. Please try again.' };
  }

  if (!interested) {
    return persistWithdrawal(supabase, {
      opportunity,
      lp,
      actorProfileId: null,
      source: 'password_gate',
    });
  }

  if (AMOUNT_REQUIRED_STATUSES.includes(opportunity.status) && amountCents === null) {
    return { status: 'error', message: 'Enter a valid interest amount.' };
  }

  return persistInterest(supabase, {
    opportunity,
    lp,
    amountCents,
    actorProfileId: null,
    source: 'password_gate',
  });
}

export async function saveOpportunityInterest(
  payload: z.infer<typeof saveInterestSchema>,
): Promise<SaveOpportunityInterestResult> {
  const parsed = saveInterestSchema.safeParse(payload);

  if (!parsed.success) {
    return { status: 'error', message: 'Enter a valid interest amount.' };
  }

  const serverSupabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    return saveGuestOpportunityInterest(
      parsed.data.opportunityId,
      parsed.data.amountCents,
      parsed.data.interested,
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data: lp } = await supabase
    .from('lps')
    .select('id, status, email, full_name')
    .eq('profile_id', user.id)
    .maybeSingle();

  if (lp?.status !== 'approved') {
    return { status: 'error', message: 'Only approved LPs can reserve interest.' };
  }

  const { data: opportunity } = await supabase
    .from('opportunities')
    .select('id, slug, title, status, target_allocation_cents')
    .eq('id', parsed.data.opportunityId)
    .maybeSingle();

  // Insider visibility model: an approved LP (enforced above) can indicate
  // interest on any non-draft opportunity without a per-opportunity grant or
  // the visible_to_all flag — this mirrors the SELECT/visibility policy.
  // Drafts never accept interest.
  if (!opportunity || !SHAREABLE_STATUSES.includes(opportunity.status)) {
    return { status: 'error', message: 'This opportunity is not currently accepting interest.' };
  }

  if (!parsed.data.interested) {
    return persistWithdrawal(supabase, {
      opportunity,
      lp: { id: lp.id, email: lp.email, full_name: lp.full_name },
      actorProfileId: user.id,
      source: 'lp',
    });
  }

  if (AMOUNT_REQUIRED_STATUSES.includes(opportunity.status) && parsed.data.amountCents === null) {
    return { status: 'error', message: 'Enter a valid interest amount.' };
  }

  return persistInterest(supabase, {
    opportunity,
    lp: { id: lp.id, email: lp.email, full_name: lp.full_name },
    amountCents: parsed.data.amountCents,
    actorProfileId: user.id,
    source: 'lp',
  });
}

type UnlockableOpportunity = {
  id: string;
  slug: string;
  title: string;
  status: string;
  published_at: string | null;
  password_protected: boolean;
  target_allocation_cents: number | string | null;
};

// Load a password-protected opportunity that is currently shareable, or null.
// We intentionally do not distinguish "not found" from "not shareable" so the
// gate never reveals whether a given slug exists or is password protected.
async function loadUnlockableOpportunity(
  supabase: AdminSupabaseClient,
  slug: string,
): Promise<UnlockableOpportunity | null> {
  const { data: opportunity } = await supabase
    .from('opportunities')
    .select('id, slug, title, status, published_at, password_protected, target_allocation_cents')
    .eq('slug', slug)
    .is('archived_at', null)
    .maybeSingle();

  if (
    !opportunity
    || !opportunity.password_protected
    || opportunity.published_at === null
    || !SHAREABLE_STATUSES.includes(opportunity.status)
  ) {
    return null;
  }

  return opportunity;
}

// The gate password lives in its own LP-inaccessible table. Read it via the
// service-role client and compare server-side; it is never sent to the client.
async function opportunityPasswordIsCorrect(
  supabase: AdminSupabaseClient,
  opportunityId: string,
  password: string,
) {
  const { data: accessPassword } = await supabase
    .from('opportunity_access_passwords')
    .select('password')
    .eq('opportunity_id', opportunityId)
    .maybeSingle();

  return Boolean(
    accessPassword && opportunityPasswordMatches(password, accessPassword.password),
  );
}

// Final access grant for an outsider: upsert their outsider-LP row (with name),
// record the unlock as a tracked lead + audit row, and set the signed,
// opportunity-scoped session cookie the detail page checks. Callers must have
// already verified the password AND email verification (cookie or code).
async function grantOpportunityAccess(
  supabase: AdminSupabaseClient,
  opportunity: UnlockableOpportunity,
  email: string,
  fullName: string,
): Promise<VerifyOpportunityAccessResult> {
  const { lp, created, error } = await findOrCreateOutsiderLp(supabase, email, fullName);

  if (error || !lp) {
    return { status: 'error', message: error ?? 'Could not record your access. Please try again.' };
  }

  if (created) {
    await notifySlackInvestorJoined({
      kind: 'outsider',
      investorName: lp.full_name || email,
      investorEmail: email,
      opportunityTitle: opportunity.title,
      joinedAt: new Date().toISOString(),
    });
  }

  // Record the unlock itself as a tracked lead (interest, no amount yet).
  await persistInterest(supabase, {
    opportunity,
    lp,
    amountCents: null,
    actorProfileId: null,
    source: 'password_gate',
  });

  await supabase.from('audit_log').insert({
    actor_profile_id: null,
    actor_role: 'lp',
    action: 'opportunity.viewed',
    entity_type: 'opportunity',
    entity_id: opportunity.id,
    metadata: { slug: opportunity.slug, lp_id: lp.id, source: 'password_gate' },
  });

  const cookieStore = await cookies();
  cookieStore.set(
    opportunityAccessCookieName(opportunity.id),
    createOpportunityAccessToken(opportunity.id, email),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      // Session cookie: no maxAge/expires, cleared when the browser closes.
    },
  );

  return { status: 'granted', slug: opportunity.slug };
}

// Step 1 of the public gate for a password-protected opportunity shared via a
// direct link. A visitor (typically not logged in) enters First/Last name,
// email, and the admin-chosen password.
//
// On a correct password we either:
//   - grant access immediately, if this browser already holds a valid ~30-day
//     "verified" cookie for THIS email + opportunity (skip the code step); or
//   - generate a 6-digit code, store its HASH (short TTL, attempt-limited),
//     email it to the entered address, and ask the visitor to enter it.
export async function requestOpportunityAccess(
  payload: z.infer<typeof requestAccessSchema>,
): Promise<RequestOpportunityAccessResult> {
  const parsed = requestAccessSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Enter your name, the password, and a valid email address.',
    };
  }

  const supabase = createSupabaseAdminClient();

  // Throttle password attempts per IP + slug across both gate actions before
  // touching the password, so this endpoint can't be used as a brute-force
  // oracle and the throttled response never reveals whether the password matched.
  const clientIp = await getClientIp();
  const passwordAttempts = await incrementGateRateLimit(
    supabase,
    `gate-pwd:${parsed.data.slug}:${clientIp}`,
    GATE_PASSWORD_WINDOW_SECONDS,
  );

  if (gateRateLimitExceeded(passwordAttempts, GATE_PASSWORD_MAX_ATTEMPTS)) {
    return { status: 'error', message: GATE_THROTTLED_MESSAGE };
  }

  const opportunity = await loadUnlockableOpportunity(supabase, parsed.data.slug);

  if (!opportunity) {
    return { status: 'error', message: 'Incorrect password.' };
  }

  if (!(await opportunityPasswordIsCorrect(supabase, opportunity.id, parsed.data.password))) {
    return { status: 'error', message: 'Incorrect password.' };
  }

  const fullName = `${parsed.data.firstName} ${parsed.data.lastName}`.trim();

  // Returning visitor who already verified this email for this opportunity
  // within the 30-day window skips the emailed-code step.
  const cookieStore = await cookies();
  const verifiedToken = cookieStore.get(opportunityVerifiedCookieName(opportunity.id))?.value;

  if (isOpportunityVerifiedTokenValid(verifiedToken, opportunity.id, parsed.data.email)) {
    return grantOpportunityAccess(supabase, opportunity, parsed.data.email, fullName);
  }

  if (!hasLoopsLoginCodeEnv()) {
    return {
      status: 'error',
      message: 'Email verification is temporarily unavailable. Please try again later.',
    };
  }

  // Cap verification-email issuance per recipient email (anti-bombing) and per
  // source IP before we send anything. Both buckets are incremented so either
  // dimension can trip the limit.
  const emailIssuances = await incrementGateRateLimit(
    supabase,
    `gate-code-email:${parsed.data.email}`,
    GATE_CODE_EMAIL_WINDOW_SECONDS,
  );
  const ipIssuances = await incrementGateRateLimit(
    supabase,
    `gate-code-ip:${clientIp}`,
    GATE_CODE_IP_WINDOW_SECONDS,
  );

  if (
    gateRateLimitExceeded(emailIssuances, GATE_CODE_MAX_PER_EMAIL)
    || gateRateLimitExceeded(ipIssuances, GATE_CODE_MAX_PER_IP)
  ) {
    return { status: 'error', message: GATE_THROTTLED_MESSAGE };
  }

  const code = generateVerificationCode();
  const { error: upsertError } = await supabase
    .from('opportunity_access_verifications')
    .upsert(
      {
        opportunity_id: opportunity.id,
        email: parsed.data.email,
        code_hash: hashVerificationCode(code),
        expires_at: new Date(Date.now() + VERIFICATION_TTL_MS).toISOString(),
        attempts: 0,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'opportunity_id,email' },
    );

  if (upsertError) {
    return { status: 'error', message: 'Could not start email verification. Please try again.' };
  }

  try {
    await sendLoginCodeEmail({ email: parsed.data.email, loginCode: code });
  } catch {
    return {
      status: 'error',
      message: 'We could not send your verification email. Please try again.',
    };
  }

  return { status: 'code_sent' };
}

// Step 2 of the public gate: the visitor submits the 6-digit code we emailed.
// We re-verify the password (defense in depth), then validate the code against
// the stored hash: not expired, attempts under the limit, single use. On
// success we grant access and set the ~30-day "verified" cookie so this email
// skips the code step on return (until it expires or the email changes).
export async function verifyOpportunityAccess(
  payload: z.infer<typeof verifyAccessSchema>,
): Promise<VerifyOpportunityAccessResult> {
  const parsed = verifyAccessSchema.safeParse(payload);

  if (!parsed.success) {
    return { status: 'error', message: 'Enter the 6-digit code we emailed you.' };
  }

  const supabase = createSupabaseAdminClient();

  // This action re-checks the gate password (defense in depth), so it is the
  // same brute-force surface as requestOpportunityAccess. Share the per-IP+slug
  // password-attempt bucket so attempts across both endpoints count together.
  const clientIp = await getClientIp();
  const passwordAttempts = await incrementGateRateLimit(
    supabase,
    `gate-pwd:${parsed.data.slug}:${clientIp}`,
    GATE_PASSWORD_WINDOW_SECONDS,
  );

  if (gateRateLimitExceeded(passwordAttempts, GATE_PASSWORD_MAX_ATTEMPTS)) {
    return { status: 'error', message: GATE_THROTTLED_MESSAGE };
  }

  const opportunity = await loadUnlockableOpportunity(supabase, parsed.data.slug);

  if (!opportunity) {
    return { status: 'error', message: 'Incorrect password.' };
  }

  if (!(await opportunityPasswordIsCorrect(supabase, opportunity.id, parsed.data.password))) {
    return { status: 'error', message: 'Incorrect password.' };
  }

  const { data: verification } = await supabase
    .from('opportunity_access_verifications')
    .select('code_hash, expires_at, attempts')
    .eq('opportunity_id', opportunity.id)
    .eq('email', parsed.data.email)
    .maybeSingle();

  const clearVerification = () =>
    supabase
      .from('opportunity_access_verifications')
      .delete()
      .eq('opportunity_id', opportunity.id)
      .eq('email', parsed.data.email);

  if (!verification) {
    return { status: 'error', message: 'Your code expired. Request a new one and try again.' };
  }

  if (new Date(verification.expires_at).getTime() < Date.now()) {
    await clearVerification();
    return { status: 'error', message: 'Your code expired. Request a new one and try again.' };
  }

  if (verification.attempts >= VERIFICATION_MAX_ATTEMPTS) {
    await clearVerification();
    return {
      status: 'error',
      message: 'Too many attempts. Request a new code and try again.',
    };
  }

  if (!verificationCodeMatches(parsed.data.code, verification.code_hash)) {
    await supabase
      .from('opportunity_access_verifications')
      .update({ attempts: verification.attempts + 1 })
      .eq('opportunity_id', opportunity.id)
      .eq('email', parsed.data.email);

    return { status: 'error', message: 'That code did not work. Check it and try again.' };
  }

  // Single use: consume the verification row before granting access.
  await clearVerification();

  const fullName = `${parsed.data.firstName} ${parsed.data.lastName}`.trim();
  const granted = await grantOpportunityAccess(
    supabase,
    opportunity,
    parsed.data.email,
    fullName,
  );

  if (granted.status !== 'granted') {
    return granted;
  }

  const cookieStore = await cookies();
  cookieStore.set(
    opportunityVerifiedCookieName(opportunity.id),
    createOpportunityVerifiedToken(opportunity.id, parsed.data.email),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: Math.floor(OPPORTUNITY_VERIFIED_TTL_MS / 1000),
    },
  );

  return { status: 'granted', slug: opportunity.slug };
}
