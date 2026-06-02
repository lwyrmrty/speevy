import type { Metadata } from 'next';

import {
  AdminInvestorsTable,
  type AdminInvestorRow,
} from '@/components/webflow/admin-investors-table';
import { AdminInvestorsFallbackScript } from '@/components/webflow/admin-investors-fallback-script';
import { CopyInvestorInviteLinkButton } from '@/components/webflow/copy-investor-invite-link-button';
import { INVESTOR_SECTORS, type InvestorSector } from '@/lib/investor-request';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = {
  title: 'Manage Investors | Speevy',
};

type LpStatus = 'invited' | 'onboarding' | 'pending_review' | 'approved' | 'rejected' | 'removed';

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
};

type InterestRow = {
  lp_id: string;
  amount_cents: number | string | null;
  opportunities: {
    title: string;
    logo_storage_key: string | null;
  }[] | null;
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

export default async function AdminInvestorsPage() {
  const supabase = createSupabaseAdminClient();
  const { data: investorsData } = await supabase
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
      created_at
    `)
    .neq('status', 'removed')
    .order('updated_at', { ascending: false });

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
    const opportunity = interest.opportunities?.[0];
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
  const rows: AdminInvestorRow[] = investors.map((investor) => ({
    id: investor.id,
    email: investor.email,
    fullName: investor.full_name,
    entityName: investor.entity_name,
    status: investor.status,
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
  }));

  return (
    <div className="pagecontainer">
      <div className="pagecontent">
        <div className="pagemain">
          <div>
            <div className="tableheader">
              <div className="pagetitle">Manage Investors</div>
              <CopyInvestorInviteLinkButton />
            </div>
            <AdminInvestorsTable investors={rows} />
            <AdminInvestorsFallbackScript />
          </div>
        </div>
      </div>
    </div>
  );
}
