'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { INVESTOR_SECTORS } from '@/lib/investor-request';
import {
  hasLoopsLpApprovedEnv,
  sendLpApprovedEmail,
} from '@/lib/loops/transactional';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const lpStatusSchema = z.enum(['invited', 'onboarding', 'pending_review', 'approved', 'rejected', 'removed', 'outsider']);

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

type ApprovedInvestorEmailRow = {
  id: string;
  email: string;
  full_name: string | null;
};

function deriveFirstName(fullName: string | null, email: string) {
  const trimmed = fullName?.trim();
  if (trimmed) {
    return trimmed.split(/\s+/)[0];
  }
  return email;
}

function logEmailFailures(label: string, results: PromiseSettledResult<unknown>[]) {
  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.error(`${label} failed:`, result.reason instanceof Error ? result.reason.message : result.reason);
    }
  });
}

async function sendLpApprovedEmails(investors: ApprovedInvestorEmailRow[], approvedAt: string) {
  if (!hasLoopsLpApprovedEnv() || investors.length === 0) {
    return;
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://speevy.vc').replace(/\/$/, '');
  const results = await Promise.allSettled(
    investors.map((investor) =>
      sendLpApprovedEmail({
        approvedAt,
        email: investor.email,
        firstName: deriveFirstName(investor.full_name, investor.email),
        investorName: investor.full_name || investor.email,
        loginUrl: `${appUrl}/login`,
        idempotencyKey: `lp-approved-${investor.id}-${approvedAt}`,
      }),
    ),
  );
  logEmailFailures('LP approved email', results);
}

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
  const { data: existingInvestor, error: existingError } = await supabase
    .from('lps')
    .select('id, email, full_name, status')
    .eq('id', data.id)
    .maybeSingle();

  if (existingError) {
    return { status: 'error', message: existingError.message };
  }

  if (!existingInvestor) {
    return { status: 'error', message: 'Investor could not be found.' };
  }

  const approvedAt = new Date().toISOString();
  const shouldSendApprovalEmail = data.status === 'approved' && existingInvestor.status !== 'approved';
  const { error } = await supabase
    .from('lps')
    .update({
      full_name: data.fullName || null,
      entity_name: data.entityName || null,
      status: data.status,
      sectors_interested: data.sectors,
      investment_range_min_cents: minCents,
      investment_range_max_cents: maxCents,
      ...(shouldSendApprovalEmail
        ? {
            approved_at: approvedAt,
            approved_by_profile_id: auth.userId,
          }
        : {}),
      updated_at: approvedAt,
    })
    .eq('id', data.id);

  if (error) {
    return { status: 'error', message: error.message };
  }

  if (shouldSendApprovalEmail) {
    await sendLpApprovedEmails([
      {
        id: data.id,
        email: existingInvestor.email,
        full_name: data.fullName || existingInvestor?.full_name || null,
      },
    ], approvedAt);
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
    .select('id, email, full_name, status')
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

  await sendLpApprovedEmails(
    (investors ?? []).map((investor) => ({
      id: investor.id,
      email: investor.email,
      full_name: investor.full_name,
    })),
    now,
  );

  revalidatePath('/admin/investors');
  return {
    status: 'success',
    message: `${uniqueIds.length} ${uniqueIds.length === 1 ? 'investor' : 'investors'} approved.`,
  };
}
