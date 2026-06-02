'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { INVESTOR_SECTORS } from '@/lib/investor-request';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const lpStatusSchema = z.enum(['invited', 'onboarding', 'pending_review', 'approved', 'rejected', 'removed']);

const updateInvestorSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().trim().optional(),
  entityName: z.string().trim().optional(),
  status: lpStatusSchema,
  sectors: z.array(z.enum(INVESTOR_SECTORS)).default([]),
  investmentRangeMin: z.coerce.number().int().nonnegative().nullable(),
  investmentRangeMax: z.coerce.number().int().nonnegative().nullable(),
});

export type UpdateInvestorResult =
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

async function ensureAdmin() {
  const serverSupabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    return { ok: false, message: 'Sign in as an admin before editing investors.' };
  }

  const supabase = createSupabaseAdminClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    return { ok: false, message: 'Only admins can edit investors.' };
  }

  return { ok: true, message: '' };
}

export async function updateInvestor(formData: FormData): Promise<UpdateInvestorResult> {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return { status: 'error', message: auth.message };
  }

  const parsed = updateInvestorSchema.safeParse({
    id: formData.get('id'),
    fullName: formData.get('fullName') ?? '',
    entityName: formData.get('entityName') ?? '',
    status: formData.get('status'),
    sectors: formData.getAll('sectors'),
    investmentRangeMin: formData.get('investmentRangeMin') || null,
    investmentRangeMax: formData.get('investmentRangeMax') || null,
  });

  if (!parsed.success) {
    return { status: 'error', message: 'Please check the investor details and try again.' };
  }

  const data = parsed.data;
  const minCents = data.investmentRangeMin === null ? null : data.investmentRangeMin * 100;
  const maxCents = data.investmentRangeMax === null ? null : data.investmentRangeMax * 100;

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('lps')
    .update({
      full_name: data.fullName || null,
      entity_name: data.entityName || null,
      status: data.status,
      sectors_interested: data.sectors,
      investment_range_min_cents: minCents,
      investment_range_max_cents: maxCents,
      updated_at: new Date().toISOString(),
    })
    .eq('id', data.id);

  if (error) {
    return { status: 'error', message: error.message };
  }

  revalidatePath('/admin/investors');
  return { status: 'success', message: 'Investor updated.' };
}
