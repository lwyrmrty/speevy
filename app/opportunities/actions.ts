'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import {
  hasLoopsAdminInterestEnv,
  sendAdminInterestEmail,
} from '@/lib/loops/transactional';
import {
  createOpportunityAccessToken,
  opportunityAccessCookieName,
  verifyOpportunityAccessToken,
} from '@/lib/opportunity-access';
import { hashOpportunityPassword } from '@/lib/opportunity-password';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const saveInterestSchema = z.object({
  opportunityId: z.string().uuid(),
  amountCents: z.number().int().positive().nullable(),
});

const unlockOpportunitySchema = z.object({
  slug: z.string().trim().min(1),
  password: z.string().min(1),
  email: z.string().trim().toLowerCase().email(),
});

type AdminSupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

const SHAREABLE_STATUSES = ['active', 'potential', 'past'];

export type UnlockOpportunityResult =
  | { status: 'success'; slug: string }
  | { status: 'error'; message: string };

// Find an existing LP by email or create a lightweight "outsider" LP row for a
// visitor who unlocked a password-protected opportunity. Outsiders have no auth
// user (profile_id stays null) and no invitation; their email is the only
// identity we have. We never downgrade an existing LP (e.g. an approved
// insider) who happens to reuse the same email here.
async function findOrCreateOutsiderLp(supabase: AdminSupabaseClient, email: string) {
  const { data: existing } = await supabase
    .from('lps')
    .select('id, email, full_name, status')
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    return { lp: existing, error: null as string | null };
  }

  const { data: created, error } = await supabase
    .from('lps')
    .insert({ email, status: 'outsider' })
    .select('id, email, full_name, status')
    .single();

  if (error || !created) {
    return { lp: null, error: error?.message ?? 'Could not record your access.' };
  }

  return { lp: created, error: null as string | null };
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

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://speevy.vc').replace(/\/$/, '');
  await sendAdminInterestEmail({
    adminInterestUrl: `${appUrl}/admin/opportunities/${opportunitySlug}/interest`,
    amount: formatInterestAmount(amountCents),
    email: recipientEmail,
    indicatedAt,
    investorEmail,
    investorName,
    opportunityTitle,
    opportunityUrl: `${appUrl}/opportunities/${opportunitySlug}`,
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
    .select('id, slug, title, status, published_at, password_protected')
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

  if (['active', 'potential'].includes(opportunity.status) && amountCents === null) {
    return { status: 'error', message: 'Enter a valid interest amount.' };
  }

  const { lp, error } = await findOrCreateOutsiderLp(supabase, email);

  if (error || !lp) {
    return { status: 'error', message: error ?? 'Unable to save interest. Please try again.' };
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
    return saveGuestOpportunityInterest(parsed.data.opportunityId, parsed.data.amountCents);
  }

  const supabase = createSupabaseAdminClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const isAdmin = profile?.role === 'admin';
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
    .select('id, slug, title, status, published_at, visible_to_all_approved_lps')
    .eq('id', parsed.data.opportunityId)
    .maybeSingle();

  if (!opportunity || !SHAREABLE_STATUSES.includes(opportunity.status)) {
    return { status: 'error', message: 'This opportunity is not currently accepting interest.' };
  }

  if (!isAdmin && opportunity.published_at === null) {
    return { status: 'error', message: 'This opportunity is not currently accepting interest.' };
  }

  if (!isAdmin && !opportunity.visible_to_all_approved_lps) {
    const { data: access } = await supabase
      .from('opportunity_access')
      .select('opportunity_id')
      .eq('opportunity_id', opportunity.id)
      .eq('lp_id', lp.id)
      .is('revoked_at', null)
      .maybeSingle();

    if (!access) {
      return { status: 'error', message: 'This opportunity is not currently accepting interest.' };
    }
  }

  if (['active', 'potential'].includes(opportunity.status)) {
    if (parsed.data.amountCents === null) {
      return { status: 'error', message: 'Enter a valid interest amount.' };
    }
  }

  return persistInterest(supabase, {
    opportunity,
    lp: { id: lp.id, email: lp.email, full_name: lp.full_name },
    amountCents: parsed.data.amountCents,
    actorProfileId: user.id,
    source: 'lp',
  });
}

// Public unlock for a password-protected opportunity shared via direct link.
// A visitor (typically not logged in) enters the admin-chosen password and
// their email. On success we record them as an "outsider" lead (tracked
// interest) and set a signed, opportunity-scoped session cookie that grants
// access to this one opportunity.
export async function unlockOpportunity(
  payload: z.infer<typeof unlockOpportunitySchema>,
): Promise<UnlockOpportunityResult> {
  const parsed = unlockOpportunitySchema.safeParse(payload);

  if (!parsed.success) {
    return { status: 'error', message: 'Enter the password and a valid email address.' };
  }

  const supabase = createSupabaseAdminClient();
  const { data: opportunity } = await supabase
    .from('opportunities')
    .select('id, slug, title, status, published_at, password_protected, password_hash')
    .eq('slug', parsed.data.slug)
    .is('archived_at', null)
    .maybeSingle();

  // Do not reveal whether a given slug exists or is password protected.
  if (
    !opportunity
    || !opportunity.password_protected
    || !opportunity.password_hash
    || opportunity.published_at === null
    || !SHAREABLE_STATUSES.includes(opportunity.status)
  ) {
    return { status: 'error', message: 'Incorrect password.' };
  }

  if (hashOpportunityPassword(parsed.data.password) !== opportunity.password_hash) {
    return { status: 'error', message: 'Incorrect password.' };
  }

  const { lp, error } = await findOrCreateOutsiderLp(supabase, parsed.data.email);

  if (error || !lp) {
    return { status: 'error', message: error ?? 'Could not record your access. Please try again.' };
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
    createOpportunityAccessToken(opportunity.id, parsed.data.email),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      // Session cookie: no maxAge/expires, cleared when the browser closes.
    },
  );

  return { status: 'success', slug: opportunity.slug };
}
