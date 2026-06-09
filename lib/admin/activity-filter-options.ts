import { createLpProfilePictureSignedUrl } from '@/lib/lp-profile-picture';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type ActivityFilterOption = {
  id: string;
  label: string;
  imageUrl: string | null;
};

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

async function signedOpportunityLogoUrl(storageKey: string | null) {
  if (!storageKey) return null;

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.storage
    .from('opportunity-assets')
    .createSignedUrl(storageKey, 60 * 60);

  return data?.signedUrl ?? null;
}

export async function getActivityOpportunityFilterOptions(): Promise<ActivityFilterOption[]> {
  const supabase = createSupabaseAdminClient();

  const [{ data: interestsData }, { data: auditData }] = await Promise.all([
    supabase.from('interests').select('opportunity_id').neq('status', 'withdrawn'),
    supabase
      .from('audit_log')
      .select('entity_id')
      .eq('entity_type', 'opportunity')
      .not('entity_id', 'is', null),
  ]);

  const opportunityIds = uniqueIds([
    ...(interestsData ?? []).map((row) => row.opportunity_id),
    ...(auditData ?? []).map((row) => row.entity_id),
  ]);

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

export async function getActivityInvestorFilterOptions(): Promise<ActivityFilterOption[]> {
  const supabase = createSupabaseAdminClient();

  const [
    { data: interestsData },
    { data: lpAuditData },
    { data: actorAuditData },
    { data: accountNdaData },
  ] = await Promise.all([
    supabase.from('interests').select('lp_id').neq('status', 'withdrawn'),
    supabase
      .from('audit_log')
      .select('entity_id')
      .eq('entity_type', 'lp')
      .not('entity_id', 'is', null),
    supabase
      .from('audit_log')
      .select('actor_profile_id, metadata')
      .not('actor_profile_id', 'is', null),
    supabase.from('account_ndas').select('lp_id'),
  ]);

  const actorProfileIds = uniqueIds(
    (actorAuditData ?? []).map((row) => row.actor_profile_id),
  );

  const { data: actorLpsData } = actorProfileIds.length
    ? await supabase
      .from('lps')
      .select('id')
      .in('profile_id', actorProfileIds)
    : { data: [] };

  const metadataLpIds = (actorAuditData ?? [])
    .map((row) => {
      const metadata = row.metadata;
      if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        return null;
      }

      const lpId = 'lp_id' in metadata && typeof metadata.lp_id === 'string'
        ? metadata.lp_id
        : null;

      return lpId;
    });

  const lpIds = uniqueIds([
    ...(interestsData ?? []).map((row) => row.lp_id),
    ...(lpAuditData ?? []).map((row) => row.entity_id),
    ...(accountNdaData ?? []).map((row) => row.lp_id),
    ...(actorLpsData ?? []).map((row) => row.id),
    ...metadataLpIds,
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
