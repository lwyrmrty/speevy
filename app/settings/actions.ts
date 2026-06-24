'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { INVESTMENT_RANGE_VALUES, INVESTOR_SECTORS } from '@/lib/investor-request';
import { LP_NOTIFICATION_PREFERENCE_VALUES } from '@/lib/lp/notification-preferences';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type LpSettingsActionState =
  | { status: 'idle'; message: string }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

export type LpNotificationPreferencesActionState = LpSettingsActionState;

const investmentRangeSchema = z.coerce.number().int().refine(
  (value) => (INVESTMENT_RANGE_VALUES as readonly number[]).includes(value),
  'Select a valid capital range.',
);

const lpSettingsSchema = z.object({
  fullName: z.string().trim().min(1).max(256),
  sectors: z.array(z.enum(INVESTOR_SECTORS)).default([]),
  investmentRangeMin: investmentRangeSchema.nullable(),
  investmentRangeMax: investmentRangeSchema.nullable(),
}).refine(
  (data) =>
    data.investmentRangeMin === null
    || data.investmentRangeMax === null
    || data.investmentRangeMin < data.investmentRangeMax,
  {
    message: 'Choose a max capital range greater than the min.',
    path: ['investmentRangeMax'],
  },
);

export async function updateLpSettings(
  _previousState: LpSettingsActionState,
  formData: FormData,
): Promise<LpSettingsActionState> {
  const serverSupabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    return { status: 'error', message: 'Sign in before updating your settings.' };
  }

  const parsed = lpSettingsSchema.safeParse({
    fullName: formData.get('fullName') ?? '',
    sectors: formData.getAll('sectors'),
    investmentRangeMin: formData.get('investmentRangeMin') || null,
    investmentRangeMax: formData.get('investmentRangeMax') || null,
  });

  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Check your settings and try again.' };
  }

  const supabase = createSupabaseAdminClient();
  const { data: lp } = await supabase
    .from('lps')
    .select('id, status')
    .eq('profile_id', user.id)
    .maybeSingle();

  if (!lp) {
    return { status: 'error', message: 'We could not find an LP profile for your account.' };
  }

  if (lp.status !== 'approved') {
    return { status: 'error', message: 'Your LP profile must be approved before editing settings.' };
  }

  const settings = parsed.data;
  const minCents = settings.investmentRangeMin === null ? null : settings.investmentRangeMin * 100;
  const maxCents = settings.investmentRangeMax === null ? null : settings.investmentRangeMax * 100;
  const updatedAt = new Date().toISOString();

  const { error: lpError } = await supabase
    .from('lps')
    .update({
      full_name: settings.fullName,
      sectors_interested: settings.sectors,
      investment_range_min_cents: minCents,
      investment_range_max_cents: maxCents,
      updated_at: updatedAt,
    })
    .eq('id', lp.id);

  if (lpError) {
    return { status: 'error', message: lpError.message };
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      full_name: settings.fullName,
      updated_at: updatedAt,
    })
    .eq('id', user.id);

  if (profileError) {
    return { status: 'error', message: profileError.message };
  }

  revalidatePath('/settings');
  revalidatePath('/opportunities');

  return { status: 'success', message: 'Settings saved.' };
}

const lpNotificationPreferencesSchema = z.object({
  activeOpportunityPreference: z.enum(LP_NOTIFICATION_PREFERENCE_VALUES),
  newOpportunityPreference: z.enum(LP_NOTIFICATION_PREFERENCE_VALUES),
});

async function getApprovedLpForCurrentUser() {
  const serverSupabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    return { error: 'Sign in before updating your settings.' as const };
  }

  const supabase = createSupabaseAdminClient();
  const { data: lp } = await supabase
    .from('lps')
    .select('id, status')
    .eq('profile_id', user.id)
    .maybeSingle();

  if (!lp) {
    return { error: 'We could not find an LP profile for your account.' as const };
  }

  if (lp.status !== 'approved') {
    return { error: 'Your LP profile must be approved before editing settings.' as const };
  }

  return { lp, user };
}

export async function updateLpNotificationPreferences(
  payload: z.infer<typeof lpNotificationPreferencesSchema>,
): Promise<LpNotificationPreferencesActionState> {
  const parsed = lpNotificationPreferencesSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Check your notification preferences and try again.',
    };
  }

  const auth = await getApprovedLpForCurrentUser();

  if ('error' in auth) {
    return { status: 'error', message: auth.error ?? 'Unable to update notification preferences.' };
  }

  const supabase = createSupabaseAdminClient();
  const updatedAt = new Date().toISOString();
  const { error: lpError } = await supabase
    .from('lps')
    .update({
      active_opportunity_notification_preference: parsed.data.activeOpportunityPreference,
      new_opportunity_notification_preference: parsed.data.newOpportunityPreference,
      updated_at: updatedAt,
    })
    .eq('id', auth.lp.id);

  if (lpError) {
    return { status: 'error', message: lpError.message };
  }

  await supabase.from('audit_log').insert({
    actor_profile_id: auth.user.id,
    actor_role: 'lp',
    action: 'lp.notification_preferences_updated',
    entity_type: 'lp',
    entity_id: auth.lp.id,
    metadata: {
      active_opportunity_notification_preference: parsed.data.activeOpportunityPreference,
      new_opportunity_notification_preference: parsed.data.newOpportunityPreference,
    },
  });

  revalidatePath('/settings');

  return { status: 'success', message: 'Notification preferences saved.' };
}
