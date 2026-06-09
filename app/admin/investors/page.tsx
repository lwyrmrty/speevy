import { Suspense } from 'react';

import {
  AdminInvestorsTable,
  type AdminInvestorRow,
  type SignedNdaItem,
} from '@/components/webflow/admin-investors-table';
import { AdminInvestorsFallbackScript } from '@/components/webflow/admin-investors-fallback-script';
import {
  AdminInvestorsStatusFilter,
  type InvestorStatusFilterValue,
} from '@/components/webflow/admin-investors-status-filter';
import { AdminListPagination } from '@/components/webflow/admin-list-pagination';
import { CopyInvestorInviteLinkButton } from '@/components/webflow/copy-investor-invite-link-button';
import { INVESTOR_SECTORS, type InvestorSector } from '@/lib/investor-request';
import { createLpProfilePictureSignedUrl } from '@/lib/lp-profile-picture';
import { getTagsForLpIds, listTags } from '@/lib/lp-tags';
import {
  clampPage,
  DEFAULT_PAGE_SIZE,
  getPaginationOffset,
  getTotalPages,
  parsePageParam,
} from '@/lib/pagination';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type LpStatus = 'invited' | 'onboarding' | 'pending_review' | 'approved' | 'rejected' | 'removed' | 'outsider';

type InvestorRow = {
  id: string;
  email: string;
  full_name: string | null;
  entity_name: string | null;
  status: LpStatus;
  sectors_interested: unknown;
  investment_range_min_cents: number | null;
  investment_range_max_cents: number | null;
  created_at: string;
  profile_picture_storage_key: string | null;
};

type InterestRow = {
  lp_id: string;
  amount_cents: number | string | null;
  opportunities: InterestOpportunity | InterestOpportunity[] | null;
};

type InterestOpportunity = {
  title: string;
  logo_storage_key: string | null;
};

function normalizeSectors(value: unknown) {
  const sectors = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? [value]
      : [];

  return Array.from(new Set(
    sectors.filter((sector): sector is string =>
      typeof sector === 'string'
      && sector.trim().length > 0
      && (INVESTOR_SECTORS as readonly string[]).includes(sector),
    ),
  )) as InvestorSector[];
}

function getInterestOpportunity(opportunities: InterestRow['opportunities']) {
  return Array.isArray(opportunities) ? opportunities[0] : opportunities;
}

type NdaRelationName = { name: string | null } | { name: string | null }[] | null;
type NdaRelationTitle = { title: string | null } | { title: string | null }[] | null;

function relationName(relation: NdaRelationName) {
  const value = Array.isArray(relation) ? relation[0] : relation;
  return value?.name ?? null;
}

function relationTitle(relation: NdaRelationTitle) {
  const value = Array.isArray(relation) ? relation[0] : relation;
  return value?.title ?? null;
}

type AccountNdaQueryRow = {
  id: string;
  lp_id: string;
  status: string;
  signed_at: string | null;
  signed_document_storage_key: string | null;
  nda_templates: NdaRelationName;
};

type OpportunityNdaQueryRow = {
  id: string;
  lp_id: string;
  status: string;
  signed_at: string | null;
  signed_document_storage_key: string | null;
  opportunities: NdaRelationTitle;
};

function parseStatusFilter(value: string | string[] | undefined): InvestorStatusFilterValue {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'insider' || raw === 'outsider' ? raw : 'all';
}

export default async function AdminInvestorsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    investor?: string | string[];
    status?: string | string[];
    page?: string | string[];
  }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialSelectedInvestorId = Array.isArray(resolvedSearchParams.investor)
    ? resolvedSearchParams.investor[0]
    : resolvedSearchParams.investor;
  const statusFilter = parseStatusFilter(resolvedSearchParams.status);
  const requestedPage = parsePageParam(resolvedSearchParams.page);
  const pageSize = DEFAULT_PAGE_SIZE;
  const supabase = createSupabaseAdminClient();

  let investorsCountQuery = supabase
    .from('lps')
    .select('id', { count: 'exact', head: true })
    .neq('status', 'removed');

  if (statusFilter === 'outsider') {
    investorsCountQuery = investorsCountQuery.eq('status', 'outsider');
  } else if (statusFilter === 'insider') {
    investorsCountQuery = investorsCountQuery.neq('status', 'outsider');
  }

  const { count: investorCount } = await investorsCountQuery;
  const totalCount = investorCount ?? 0;
  const totalPages = getTotalPages(totalCount, pageSize);
  const page = clampPage(requestedPage, totalPages);
  const offset = getPaginationOffset(page, pageSize);

  // "Insiders" are invited LPs (any lifecycle status other than 'outsider');
  // "outsiders" unlocked a password-protected opportunity via a shared link.
  let investorsQuery = supabase
    .from('lps')
    .select(`
      id,
      email,
      full_name,
      entity_name,
      status,
      sectors_interested,
      investment_range_min_cents,
      investment_range_max_cents,
      created_at,
      profile_picture_storage_key
    `)
    .neq('status', 'removed');

  if (statusFilter === 'outsider') {
    investorsQuery = investorsQuery.eq('status', 'outsider');
  } else if (statusFilter === 'insider') {
    investorsQuery = investorsQuery.neq('status', 'outsider');
  }

  const { data: investorsData } = await investorsQuery
    .order('updated_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  const investors = (investorsData ?? []) as InvestorRow[];
  const investorIds = investors.map((investor) => investor.id);
  const signedAssetUrl = async (storageKey: string | null) => {
    if (!storageKey) return null;
    const { data } = await supabase.storage
      .from('opportunity-assets')
      .createSignedUrl(storageKey, 60 * 60);
    return data?.signedUrl ?? null;
  };
  const { data: interestsData } = investorIds.length
    ? await supabase
      .from('interests')
      .select(`
        lp_id,
        amount_cents,
        opportunities (
          title,
          logo_storage_key
        )
      `)
      .in('lp_id', investorIds)
      .neq('status', 'withdrawn')
    : { data: [] };

  const interestTotals = new Map<string, number>();
  const interestTitles = new Map<string, string[]>();
  const interestDetails = new Map<
    string,
    {
      title: string;
      amountCents: number | string | null;
      logoStorageKey: string | null;
    }[]
  >();
  investorIds.forEach((id) => interestTotals.set(id, 0));
  investorIds.forEach((id) => interestTitles.set(id, []));
  investorIds.forEach((id) => interestDetails.set(id, []));
  ((interestsData ?? []) as InterestRow[]).forEach((interest) => {
    const total = interestTotals.get(interest.lp_id);
    if (total === undefined) return;

    interestTotals.set(interest.lp_id, total + 1);
    const titles = interestTitles.get(interest.lp_id);
    const details = interestDetails.get(interest.lp_id);
    const opportunity = getInterestOpportunity(interest.opportunities);
    if (titles && opportunity?.title) {
      titles.push(opportunity.title);
    }
    if (details && opportunity?.title) {
      details.push({
        title: opportunity.title,
        amountCents: interest.amount_cents,
        logoStorageKey: opportunity.logo_storage_key,
      });
    }
  });
  const logoStorageKeys = Array.from(new Set(
    Array.from(interestDetails.values())
      .flat()
      .map((interest) => interest.logoStorageKey)
      .filter((key): key is string => Boolean(key)),
  ));
  const logoUrls = new Map(
    await Promise.all(
      logoStorageKeys.map(async (storageKey) => [
        storageKey,
        await signedAssetUrl(storageKey),
      ] as const),
    ),
  );
  const profilePictureStorageKeys = Array.from(new Set(
    investors
      .map((investor) => investor.profile_picture_storage_key)
      .filter((key): key is string => Boolean(key)),
  ));
  const profilePictureUrls = new Map(
    await Promise.all(
      profilePictureStorageKeys.map(async (storageKey) => [
        storageKey,
        await createLpProfilePictureSignedUrl(supabase, storageKey),
      ] as const),
    ),
  );
  const [allTags, tagsByLp] = await Promise.all([
    listTags(supabase),
    getTagsForLpIds(supabase, investorIds),
  ]);

  // Account + per-opportunity NDAs for the badge (derived, no new lps column) and
  // the profile drawer's "Signed NDAs" section. Download URLs are NOT minted here
  // — the drawer requests a short-lived signed URL on demand via an admin action.
  const [{ data: accountNdaData }, { data: opportunityNdaData }] = investorIds.length
    ? await Promise.all([
        supabase
          .from('account_ndas')
          .select('id, lp_id, status, signed_at, signed_document_storage_key, nda_templates ( name )')
          .in('lp_id', investorIds),
        supabase
          .from('opportunity_ndas')
          .select('id, lp_id, status, signed_at, signed_document_storage_key, opportunities ( title )')
          .in('lp_id', investorIds),
      ])
    : [{ data: [] }, { data: [] }];

  const accountNdaByLp = new Map<string, AdminInvestorRow['accountNda']>();
  const signedNdasByLp = new Map<string, SignedNdaItem[]>();
  investorIds.forEach((id) => signedNdasByLp.set(id, []));

  ((accountNdaData ?? []) as AccountNdaQueryRow[]).forEach((nda) => {
    const label = relationName(nda.nda_templates) ?? 'Account NDA';
    accountNdaByLp.set(nda.lp_id, {
      status: nda.status === 'signed' ? 'signed' : 'pending',
      signedAt: nda.signed_at,
    });
    signedNdasByLp.get(nda.lp_id)?.push({
      id: nda.id,
      tier: 'account',
      label,
      status: nda.status,
      signedAt: nda.signed_at,
      hasDocument: Boolean(nda.signed_document_storage_key),
    });
  });

  ((opportunityNdaData ?? []) as OpportunityNdaQueryRow[]).forEach((nda) => {
    signedNdasByLp.get(nda.lp_id)?.push({
      id: nda.id,
      tier: 'opportunity',
      label: relationTitle(nda.opportunities) ?? 'Opportunity NDA',
      status: nda.status,
      signedAt: nda.signed_at,
      hasDocument: Boolean(nda.signed_document_storage_key),
    });
  });
  const rows: AdminInvestorRow[] = investors.map((investor) => ({
    id: investor.id,
    email: investor.email,
    fullName: investor.full_name,
    entityName: investor.entity_name,
    status: investor.status,
    // "Insiders" are invited LPs; "outsiders" unlocked a password-protected
    // opportunity via a shared direct link.
    kind: investor.status === 'outsider' ? 'outsider' : 'insider',
    sectors: normalizeSectors(investor.sectors_interested),
    investmentRangeMin: investor.investment_range_min_cents,
    investmentRangeMax: investor.investment_range_max_cents,
    joinedAt: investor.created_at,
    interestedCount: interestTotals.get(investor.id) ?? 0,
    interestedOpportunityTitles: interestTitles.get(investor.id) ?? [],
    interestedOpportunities: (interestDetails.get(investor.id) ?? []).map((interest) => ({
      title: interest.title,
      amountCents: interest.amountCents,
      logoUrl: interest.logoStorageKey ? logoUrls.get(interest.logoStorageKey) ?? null : null,
    })),
    tags: tagsByLp.get(investor.id) ?? [],
    accountNda: accountNdaByLp.get(investor.id) ?? null,
    signedNdas: signedNdasByLp.get(investor.id) ?? [],
    profilePictureUrl: investor.profile_picture_storage_key
      ? profilePictureUrls.get(investor.profile_picture_storage_key) ?? null
      : null,
  }));

  return (
    <div className="pagecontainer">
      <div className="pagecontent">
        <div className="pagemain">
          <div>
            <div className="tableheader">
              <div className="pagetitle">Manage Investors</div>
              <div className="speevy-tableheader-actions">
                <AdminInvestorsStatusFilter value={statusFilter} />
                <CopyInvestorInviteLinkButton />
              </div>
            </div>
            <AdminInvestorsTable investors={rows} allTags={allTags} initialSelectedInvestorId={initialSelectedInvestorId ?? null} />
            <Suspense fallback={null}>
              <AdminListPagination page={page} totalPages={totalPages} />
            </Suspense>
            <AdminInvestorsFallbackScript />
          </div>
        </div>
      </div>
    </div>
  );
}
