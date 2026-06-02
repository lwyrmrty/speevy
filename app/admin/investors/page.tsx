import type { Metadata } from 'next';

import {
  AdminInvestorsTable,
  type AdminInvestorRow,
} from '@/components/webflow/admin-investors-table';
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
};

type InterestRow = {
  lp_id: string;
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
      investment_range_max_cents
    `)
    .neq('status', 'removed')
    .order('updated_at', { ascending: false });

  const investors = (investorsData ?? []) as InvestorRow[];
  const investorIds = investors.map((investor) => investor.id);
  const { data: interestsData } = investorIds.length
    ? await supabase
      .from('interests')
      .select('lp_id')
      .in('lp_id', investorIds)
      .neq('status', 'withdrawn')
    : { data: [] };

  const interestTotals = new Map<string, number>();
  investorIds.forEach((id) => interestTotals.set(id, 0));
  ((interestsData ?? []) as InterestRow[]).forEach((interest) => {
    const total = interestTotals.get(interest.lp_id);
    if (total === undefined) return;

    interestTotals.set(interest.lp_id, total + 1);
  });
  const rows: AdminInvestorRow[] = investors.map((investor) => ({
    id: investor.id,
    email: investor.email,
    fullName: investor.full_name,
    entityName: investor.entity_name,
    status: investor.status,
    sectors: normalizeSectors(investor.sectors_interested),
    investmentRangeMin: investor.investment_range_min_cents,
    investmentRangeMax: investor.investment_range_max_cents,
    interestedCount: interestTotals.get(investor.id) ?? 0,
  }));

  return (
    <div className="pagecontainer">
      <div className="pagecontent">
        <div className="pagemain">
          <div>
            <div className="tableheader">
              <div className="pagetitle">Manage Investors</div>
              <a href="#" className="button short w-inline-block">
                <div>Create New</div>
              </a>
            </div>
            <AdminInvestorsTable investors={rows} />
          </div>
        </div>
      </div>
    </div>
  );
}
