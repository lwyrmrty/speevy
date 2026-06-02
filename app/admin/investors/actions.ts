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

const bulkApproveInvestorsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export type UpdateInvestorResult =
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

async function ensureAdmin(): Promise<
  | { ok: true; message: string; userId: string }
  | { ok: false; message: string }
> {
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

  return { ok: true, message: '', userId: user.id };
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

export async function bulkApproveInvestors(ids: string[]): Promise<UpdateInvestorResult> {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return { status: 'error', message: auth.message };
  }

  const parsed = bulkApproveInvestorsSchema.safeParse({ ids });
  if (!parsed.success) {
    return { status: 'error', message: 'Select at least one valid investor to approve.' };
  }

  const uniqueIds = Array.from(new Set(parsed.data.ids));
  const supabase = createSupabaseAdminClient();
  const { data: investors, error: fetchError } = await supabase
    .from('lps')
    .select('id, status')
    .in('id', uniqueIds);

  if (fetchError) {
    return { status: 'error', message: fetchError.message };
  }

  if ((investors ?? []).length !== uniqueIds.length) {
    return { status: 'error', message: 'One or more selected investors could not be found.' };
  }

  const canApproveAll = (investors ?? []).every((investor) => investor.status === 'pending_review');
  if (!canApproveAll) {
    return { status: 'error', message: 'Only investors pending review can be bulk approved.' };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('lps')
    .update({
      status: 'approved',
      approved_at: now,
      approved_by_profile_id: auth.userId,
      updated_at: now,
    })
    .in('id', uniqueIds);

  if (error) {
    return { status: 'error', message: error.message };
  }

  revalidatePath('/admin/investors');
  return {
    status: 'success',
    message: `${uniqueIds.length} ${uniqueIds.length === 1 ? 'investor' : 'investors'} approved.`,
  };
}
