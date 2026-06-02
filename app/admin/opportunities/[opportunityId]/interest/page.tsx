import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = {
  title: 'Investor Interest | Speevy',
};

type InterestRow = {
  amount_cents: number | string | null;
  indicated_at: string;
  lps: {
    email: string;
    full_name: string | null;
  }[] | null;
};

function centsToNumber(value: number | string | null) {
  if (value === null) return 0;
  return Number(value);
}

function formatInterestAmount(value: number | string | null) {
  const cents = centsToNumber(value);
  if (!cents) return 'No amount shared';

  const dollars = cents / 100;
  return dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export default async function OpportunityInterestPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const supabase = createSupabaseAdminClient();
  const { data: opportunity } = await supabase
    .from('opportunities')
    .select('id, slug, title')
    .eq('slug', opportunityId)
    .maybeSingle();

  if (!opportunity) {
    notFound();
  }

  const { data: interestsData } = await supabase
    .from('interests')
    .select(`
      amount_cents,
      indicated_at,
      lps (
        email,
        full_name
      )
    `)
    .eq('opportunity_id', opportunity.id)
    .neq('status', 'withdrawn')
    .order('indicated_at', { ascending: false });

  const interests = (interestsData ?? []) as InterestRow[];

  return (
    <div className="pagecontainer breadcrumb">
      <div className="breadcrumbrow">
        <Link href="/admin/opportunities" className="breadcrumbicon w-inline-block" aria-label="Opportunities">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            className="homeicon"
          >
            <g>
              <path d="M19.5 0H22C23.1046 0 24 0.895453 24 2.00002V4.5C24 5.60456 23.1046 6.50002 22 6.50002H19.5C18.3955 6.50002 17.5 5.60456 17.5 4.5V2.00002C17.5 0.895453 18.3955 0 19.5 0Z" fill="currentColor" />
              <path d="M10.75 0H13.25C14.3546 0 15.25 0.895453 15.25 2.00002V4.5C15.25 5.60456 14.3546 6.50002 13.25 6.50002H10.75C9.64545 6.50002 8.75 5.60456 8.75 4.5V2.00002C8.75005 0.895453 9.64545 0 10.75 0Z" fill="currentColor" />
              <path d="M2.00002 0H4.5C5.60456 0 6.50002 0.895453 6.50002 2.00002V4.5C6.50002 5.60456 5.60456 6.50002 4.5 6.50002H2.00002C0.895453 6.50002 0 5.60456 0 4.5V2.00002C0 0.895453 0.895453 0 2.00002 0Z" fill="currentColor" />
              <path d="M19.5 8.75H22C23.1046 8.75 24 9.64545 24 10.75V13.25C24 14.3546 23.1046 15.25 22 15.25H19.5C18.3955 15.25 17.5 14.3546 17.5 13.25V10.75C17.5 9.64541 18.3955 8.75 19.5 8.75Z" fill="currentColor" />
              <path d="M10.75 8.75H13.25C14.3546 8.75 15.25 9.64545 15.25 10.75V13.25C15.25 14.3546 14.3546 15.25 13.25 15.25H10.75C9.64545 15.25 8.75 14.3546 8.75 13.25V10.75C8.75005 9.64541 9.64545 8.75 10.75 8.75Z" fill="currentColor" />
              <path d="M2.00002 8.75H4.5C5.60456 8.75 6.50002 9.64545 6.50002 10.75V13.25C6.50002 14.3546 5.60456 15.25 4.5 15.25H2.00002C0.895453 15.25 0 14.3546 0 13.25V10.75C0 9.64541 0.895453 8.75 2.00002 8.75Z" fill="currentColor" />
              <path d="M19.5 17.5H22C23.1046 17.5 24 18.3955 24 19.5V22C24 23.1046 23.1046 24 22 24H19.5C18.3955 24 17.5 23.1046 17.5 22V19.5C17.5 18.3955 18.3955 17.5 19.5 17.5Z" fill="currentColor" />
              <path d="M10.75 17.5H13.25C14.3546 17.5 15.25 18.3955 15.25 19.5V22C15.25 23.1046 14.3546 24 13.25 24H10.75C9.64545 24 8.75 23.1046 8.75 22V19.5C8.75005 18.3955 9.64545 17.5 10.75 17.5Z" fill="currentColor" />
              <path d="M2.00002 17.5H4.5C5.60456 17.5 6.50002 18.3955 6.50002 19.5V22C6.50002 23.1046 5.60456 24 4.5 24H2.00002C0.895453 24 0 23.1046 0 22V19.5C0 18.3955 0.895453 17.5 2.00002 17.5Z" fill="currentColor" />
            </g>
          </svg>
        </Link>
        <Link href={`/admin/opportunities/${opportunity.slug}/edit`} className="breadcrumblink">
          {opportunity.title}
        </Link>
      </div>
      <div className="adminnav-links">
        <Link href={`/admin/opportunities/${opportunity.slug}/edit`} className="admin-navlink w-inline-block">
          <div>Edit Opportunity</div>
        </Link>
        <Link
          href={`/admin/opportunities/${opportunity.slug}/interest`}
          aria-current="page"
          className="admin-navlink w-inline-block w--current"
        >
          <div>Investor Interest</div>
        </Link>
      </div>
      <div className="pagecontent lowtop">
        <div className="pagemain">
          <div>
            <div className="tableheader">
              <div>
                <div className="pagetitle">Investor Interest</div>
                <div className="pagesubtitle">{opportunity.title}</div>
              </div>
            </div>
            <div className="contenttable">
              <div className="tablerow headerrow">
                <div className="tablecell first">
                  <div>Investor</div>
                </div>
                <div className="tablecell">
                  <div>Interest Amount</div>
                </div>
                <div className="tablecell">
                  <div>Indicated</div>
                </div>
              </div>
              {interests.length ? (
                interests.map((interest) => {
                  const lp = interest.lps?.[0];
                  const label = lp?.full_name || lp?.email || 'Unknown investor';

                  return (
                    <div className="tablerow" key={`${label}-${interest.indicated_at}`}>
                      <div className="tablecell first">
                        <div>
                          <div className="cellname">{label}</div>
                          {lp?.email && lp.email !== label ? (
                            <div className="dimsmall">{lp.email}</div>
                          ) : null}
                        </div>
                      </div>
                      <div className="tablecell">
                        <div>{formatInterestAmount(interest.amount_cents)}</div>
                      </div>
                      <div className="tablecell">
                        <div>{formatDate(interest.indicated_at)}</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="tablerow">
                  <div className="tablecell first">
                    <div>No investor interest yet.</div>
                  </div>
                  <div className="tablecell">
                    <div>-</div>
                  </div>
                  <div className="tablecell">
                    <div>-</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
