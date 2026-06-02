'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const saveInterestSchema = z.object({
  opportunityId: z.string().uuid(),
  amountCents: z.number().int().positive(),
});

export type SaveOpportunityInterestResult =
  | { status: 'success' }
  | { status: 'error'; message: string };

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
  const { data: lp } = await supabase
    .from('lps')
    .select('id, status')
    .eq('profile_id', user.id)
    .maybeSingle();

  if (lp?.status !== 'approved') {
    return { status: 'error', message: 'Only approved LPs can reserve interest.' };
  }

  const { data: opportunity } = await supabase
    .from('opportunities')
    .select('id, slug, status, published_at')
    .eq('id', parsed.data.opportunityId)
    .maybeSingle();

  if (
    !opportunity
    || opportunity.published_at === null
    || !['active', 'potential'].includes(opportunity.status)
  ) {
    return { status: 'error', message: 'This opportunity is not currently accepting interest.' };
  }

  const { error } = await supabase
    .from('interests')
    .upsert(
      {
        opportunity_id: opportunity.id,
        lp_id: lp.id,
        status: 'indicated',
        amount_cents: parsed.data.amountCents,
        indicated_at: new Date().toISOString(),
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

  revalidatePath('/opportunities');
  revalidatePath(`/opportunities/${opportunity.slug}`);

  return { status: 'success' };
}
