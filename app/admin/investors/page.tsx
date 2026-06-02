import type { Metadata } from 'next';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = {
  title: 'Manage Investors | Speevy',
};

type LpStatus = 'invited' | 'onboarding' | 'pending_review' | 'approved' | 'rejected' | 'removed';
type VerificationStatus = 'not_started' | 'pending' | 'approved' | 'rejected' | 'expired';

type InvestorRow = {
  id: string;
  email: string;
  full_name: string | null;
  entity_name: string | null;
  status: LpStatus;
  kyc_status: VerificationStatus;
  accreditation_status: VerificationStatus;
  created_at: string;
  updated_at: string;
};

type InterestRow = {
  lp_id: string;
  amount_cents: number | string | null;
};

const statusLabels: Record<LpStatus, string> = {
  invited: 'Invited',
  onboarding: 'Onboarding',
  pending_review: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  removed: 'Removed',
};

const verificationLabels: Record<VerificationStatus, string> = {
  not_started: 'Not Started',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired',
};

function centsToNumber(value: number | string | null) {
  if (value === null) return 0;
  return Number(value);
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function statusClass(status: LpStatus) {
  if (status === 'approved') return 'cellstatus';
  if (status === 'pending_review' || status === 'onboarding') return 'cellstatus potential';
  if (status === 'invited') return 'cellstatus draft';
  return 'cellstatus past';
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
      kyc_status,
      accreditation_status,
      created_at,
      updated_at
    `)
    .neq('status', 'removed')
    .order('updated_at', { ascending: false });

  const investors = (investorsData ?? []) as InvestorRow[];
  const investorIds = investors.map((investor) => investor.id);
  const { data: interestsData } = investorIds.length
    ? await supabase
      .from('interests')
      .select('lp_id, amount_cents')
      .in('lp_id', investorIds)
      .neq('status', 'withdrawn')
    : { data: [] };

  const interestTotals = new Map<string, { count: number; amountCents: number }>();
  investorIds.forEach((id) => interestTotals.set(id, { count: 0, amountCents: 0 }));
  ((interestsData ?? []) as InterestRow[]).forEach((interest) => {
    const total = interestTotals.get(interest.lp_id);
    if (!total) return;

    total.count += 1;
    total.amountCents += centsToNumber(interest.amount_cents);
  });

  return (
    <div className="pagecontainer">
      <div className="pagecontent">
        <div className="pagemain">
          <div>
            <div className="tableheader">
              <div className="pagetitle">Manage Investors</div>
            </div>
            <div className="contenttable">
              <div className="tablerow headerrow">
                <div className="tablecell first">
                  <div className="interestchecks-row spacing">
                    <div className="checkboxtoggle sm" />
                  </div>
                  <div>Investor</div>
                </div>
                <div className="tablecell">
                  <div>Entity</div>
                </div>
                <div className="tablecell">
                  <div>Status</div>
                </div>
                <div className="tablecell">
                  <div>Interest</div>
                </div>
                <div className="tablecell actions">
                  <div>Updated</div>
                </div>
              </div>
              {investors.length ? (
                investors.map((investor) => {
                  const interest = interestTotals.get(investor.id) ?? { count: 0, amountCents: 0 };

                  return (
                    <div className="tablerow" key={investor.id}>
                      <div className="tablecell first">
                        <div className="interestchecks-row spacing">
                          <div className="checkboxtoggle sm" />
                        </div>
                        <div>
                          <div className="cellname">{investor.full_name || investor.email}</div>
                          <div className="dimsmall">{investor.email}</div>
                        </div>
                      </div>
                      <div className="tablecell">
                        <div>{investor.entity_name || 'Individual'}</div>
                      </div>
                      <div className="tablecell">
                        <div className={statusClass(investor.status)}>{statusLabels[investor.status]}</div>
                        <div className="dimsmall">
                          KYC {verificationLabels[investor.kyc_status]} · Accreditation{' '}
                          {verificationLabels[investor.accreditation_status]}
                        </div>
                      </div>
                      <div className="tablecell">
                        <div>{formatCurrency(interest.amountCents)}</div>
                        <div className="dimsmall">
                          {interest.count} {interest.count === 1 ? 'opportunity' : 'opportunities'}
                        </div>
                      </div>
                      <div className="tablecell actions">
                        <div>{formatDate(investor.updated_at || investor.created_at)}</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="tablerow">
                  <div className="tablecell first">
                    <div>No investors yet.</div>
                  </div>
                  <div className="tablecell" />
                  <div className="tablecell" />
                  <div className="tablecell" />
                  <div className="tablecell actions" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
