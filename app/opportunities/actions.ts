'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import {
  hasLoopsAdminInterestEnv,
  sendAdminInterestEmail,
} from '@/lib/loops/transactional';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const saveInterestSchema = z.object({
  opportunityId: z.string().uuid(),
  amountCents: z.number().int().positive().nullable(),
});

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
    return { status: 'error', message: 'Sign in before saving interest.' };
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

  if (!opportunity || !['active', 'potential', 'past'].includes(opportunity.status)) {
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

  const indicatedAt = new Date().toISOString();
  const { error } = await supabase
    .from('interests')
    .upsert(
      {
        opportunity_id: opportunity.id,
        lp_id: lp.id,
        status: 'indicated',
        amount_cents: parsed.data.amountCents,
        indicated_at: indicatedAt,
        withdrawn_at: null,
      },
      { onConflict: 'opportunity_id,lp_id' },
    );

  if (error) {
    return { status: 'error', message: 'Unable to save interest. Please try again.' };
  }

  await supabase.from('audit_log').insert({
    actor_profile_id: user.id,
    actor_role: 'lp',
    action: 'interest.indicated',
    entity_type: 'opportunity',
    entity_id: opportunity.id,
    metadata: {
      amount_cents: parsed.data.amountCents,
      lp_id: lp.id,
    },
  });

  const { data: admins } = await supabase
    .from('profiles')
    .select('email')
    .eq('role', 'admin');
  await Promise.allSettled(
    (admins ?? []).map((admin) =>
      sendAdminInterestNotification({
        amountCents: parsed.data.amountCents,
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
