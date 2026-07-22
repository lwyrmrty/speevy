import type { ActivityFilterOption } from '@/lib/admin/activity-filter-options';
import { createLpProfilePictureSignedUrl } from '@/lib/lp-profile-picture';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type OpportunityRow = {
  id: string;
  title: string;
  logo_storage_key: string | null;
};

type LpRow = {
  id: string;
  full_name: string | null;
  email: string;
  profile_picture_storage_key: string | null;
};

function uniqueIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function readMetadata(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

async function signedOpportunityLogoUrl(storageKey: string | null) {
  if (!storageKey) return null;

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.storage
    .from('opportunity-assets')
    .createSignedUrl(storageKey, 60 * 60);

  return data?.signedUrl ?? null;
}

export async function getMessagesOpportunityFilterOptions(): Promise<ActivityFilterOption[]> {
  const supabase = createSupabaseAdminClient();
  const { data: auditData } = await supabase
    .from('audit_log')
    .select('metadata')
    .eq('action', 'email.sent');

  const opportunityIds = uniqueIds(
    (auditData ?? []).map((row) => readString(readMetadata(row.metadata), 'opportunity_id')),
  );

  if (!opportunityIds.length) {
    return [];
  }

  const { data: opportunitiesData } = await supabase
    .from('opportunities')
    .select('id, title, logo_storage_key')
    .in('id', opportunityIds)
    .is('archived_at', null)
    .order('title', { ascending: true });

  const opportunities = (opportunitiesData ?? []) as OpportunityRow[];

  return Promise.all(
    opportunities.map(async (opportunity) => ({
      id: opportunity.id,
      label: opportunity.title,
      imageUrl: await signedOpportunityLogoUrl(opportunity.logo_storage_key),
    })),
  );
}

export async function getMessagesInvestorFilterOptions(): Promise<ActivityFilterOption[]> {
  const supabase = createSupabaseAdminClient();
  const { data: auditData } = await supabase
    .from('audit_log')
    .select('entity_id, metadata')
    .eq('action', 'email.sent');

  const lpIds = uniqueIds([
    ...(auditData ?? []).map((row) => row.entity_id),
    ...(auditData ?? []).map((row) => readString(readMetadata(row.metadata), 'lp_id')),
  ]);

  if (!lpIds.length) {
    return [];
  }

  const { data: lpsData } = await supabase
    .from('lps')
    .select('id, full_name, email, profile_picture_storage_key')
    .in('id', lpIds)
    .neq('status', 'removed')
    .order('full_name', { ascending: true });

  const lps = (lpsData ?? []) as LpRow[];

  return Promise.all(
    lps.map(async (lp) => ({
      id: lp.id,
      label: lp.full_name || lp.email,
      imageUrl: await createLpProfilePictureSignedUrl(supabase, lp.profile_picture_storage_key),
    })),
  );
}
