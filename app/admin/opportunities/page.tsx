import Link from 'next/link';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type OpportunityStatus = 'active' | 'potential' | 'coming_soon' | 'draft' | 'closed';

type OpportunityRow = {
  id: string;
  slug: string;
  title: string;
  status: OpportunityStatus;
  target_allocation_cents: number | string | null;
  thumbnail_storage_key: string | null;
  logo_storage_key: string | null;
};

type InterestRow = {
  opportunity_id: string;
  amount_cents: number | string | null;
};

type ViewRow = {
  entity_id: string | null;
};

const statusLabels: Record<OpportunityStatus, string> = {
  active: 'Active',
  potential: 'Potential',
  coming_soon: 'Coming Soon',
  draft: 'Draft',
  closed: 'Closed',
};

const statusClasses: Record<OpportunityStatus, string> = {
  active: 'cellstatus',
  potential: 'cellstatus potential',
  coming_soon: 'cellstatus potential',
  draft: 'cellstatus draft',
  closed: 'cellstatus closed',
};

// Admins want live deals first, then upcoming, then archived. Draft is slotted
// with the not-yet-live group so Closed stays last as requested.
const statusSortOrder: Record<OpportunityStatus, number> = {
  active: 0,
  potential: 1,
  coming_soon: 1,
  draft: 2,
  closed: 3,
};

function centsToNumber(value: number | string | null) {
  if (value === null) {
    return 0;
  }

  return Number(value);
}

function formatCompactCurrency(cents: number) {
  const dollars = cents / 100;
  const absDollars = Math.abs(dollars);

  if (absDollars >= 1_000_000) {
    return `$${new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 1,
    }).format(dollars / 1_000_000)}M`;
  }

  if (absDollars >= 1_000) {
    return `$${new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
    }).format(dollars / 1_000)}k`;
  }

  return dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

export default async function AdminOpportunitiesPage() {
  const supabase = createSupabaseAdminClient();
  const { data: opportunitiesData } = await supabase
    .from('opportunities')
    .select(`
      id,
      slug,
      title,
      status,
      target_allocation_cents,
      thumbnail_storage_key,
      logo_storage_key
    `)
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  const opportunities = ((opportunitiesData ?? []) as OpportunityRow[])
    .slice()
    .sort((left, right) => statusSortOrder[left.status] - statusSortOrder[right.status]);
  const opportunityIds = opportunities.map((opportunity) => opportunity.id);

  const [{ data: interestsData }, { data: viewsData }] = opportunityIds.length
    ? await Promise.all([
        supabase
          .from('interests')
          .select('opportunity_id, amount_cents')
          .in('opportunity_id', opportunityIds)
          .neq('status', 'withdrawn'),
        supabase
          .from('audit_log')
          .select('entity_id')
          .eq('entity_type', 'opportunity')
          .eq('action', 'opportunity.viewed')
          .in('entity_id', opportunityIds),
      ])
    : [{ data: [] }, { data: [] }];

  const interests = (interestsData ?? []) as InterestRow[];
  const views = (viewsData ?? []) as ViewRow[];
  const metricsByOpportunity = new Map<
    string,
    { interestedCount: number; interestAmountCents: number; viewedCount: number }
  >();

  opportunityIds.forEach((id) => {
    metricsByOpportunity.set(id, {
      interestedCount: 0,
      interestAmountCents: 0,
      viewedCount: 0,
    });
  });

  interests.forEach((interest) => {
    const metrics = metricsByOpportunity.get(interest.opportunity_id);

    if (!metrics) {
      return;
    }

    metrics.interestedCount += 1;
    metrics.interestAmountCents += centsToNumber(interest.amount_cents);
  });

  views.forEach((view) => {
    if (!view.entity_id) {
      return;
    }

    const metrics = metricsByOpportunity.get(view.entity_id);

    if (metrics) {
      metrics.viewedCount += 1;
    }
  });

  const signedAssetUrl = async (storageKey: string | null) => {
    if (!storageKey) {
      return null;
    }

    const { data } = await supabase.storage
      .from('opportunity-assets')
      .createSignedUrl(storageKey, 60 * 60);

    return data?.signedUrl ?? null;
  };

  const rows = await Promise.all(
    opportunities.map(async (opportunity) => ({
      ...opportunity,
      imageUrl: await signedAssetUrl(opportunity.logo_storage_key ?? opportunity.thumbnail_storage_key),
      metrics: metricsByOpportunity.get(opportunity.id) ?? {
        interestedCount: 0,
        interestAmountCents: 0,
        viewedCount: 0,
      },
    })),
  );

  return (
    <div className="pagecontainer">
      <div className="pagecontent">
        <div className="pagemain">
          <div>
            <div className="tableheader">
              <div className="pagetitle">Manage Opportunities</div>
              <Link
                href="/admin/opportunities/new"
                className="button short w-inline-block"
              >
                <div>Create New</div>
              </Link>
            </div>
            <div className="contenttable">
              <div className="tablerow headerrow">
                <div className="tablecell first">
                  <div className="interestchecks-row spacing">
                    <div className="checkboxtoggle sm" />
                  </div>
                  <div>Opportunity</div>
                </div>
                <div className="tablecell">
                  <div>Interest Value</div>
                </div>
                <div className="tablecell">
                  <div>Interested</div>
                </div>
                <div className="tablecell">
                  <div>Viewed</div>
                </div>
                <div className="tablecell actions">
                  <div>Actions</div>
                </div>
              </div>
              {rows.length ? (
                rows.map((opportunity) => {
                  const targetAllocationCents = centsToNumber(opportunity.target_allocation_cents);
                  const interestPercent = targetAllocationCents
                    ? Math.round((opportunity.metrics.interestAmountCents / targetAllocationCents) * 100)
                    : null;
                  const progressWidth = interestPercent === null
                    ? 0
                    : Math.min(Math.max(interestPercent, 0), 100);

                  return (
                    <div className="tablerow" key={opportunity.id}>
                      <div className="tablecell first">
                        <div className="interestchecks-row spacing">
                          <div className="checkboxtoggle sm" />
                        </div>
                        <Link
                          href={`/admin/opportunities/${opportunity.slug}/edit`}
                          className="rowicon-block"
                          aria-label={`Open ${opportunity.title}`}
                          style={{ cursor: 'pointer' }}
                        >
                          <img
                            src={opportunity.imageUrl ?? '/webflow/images/photograph.svg'}
                            loading="lazy"
                            alt=""
                            className="fullimage"
                          />
                        </Link>
                        <div>
                          <div className="cellname">{opportunity.title}</div>
                          <div className={statusClasses[opportunity.status]}>
                            {statusLabels[opportunity.status]}
                          </div>
                        </div>
                      </div>
                      <div className="tablecell">
                        {interestPercent === null ? (
                          <div>-</div>
                        ) : (
                          <div className="interestrow">
                            <div className="interestbar">
                              <div
                                className="interestprogress"
                                style={{ width: `${progressWidth}%` }}
                              >
                                <div className="percentinterest">{interestPercent}%</div>
                              </div>
                              <div className="dollarinterest">
                                {formatCompactCurrency(opportunity.metrics.interestAmountCents)}{' '}
                                <span className="dollarinterest-of">of</span>{' '}
                                {formatCompactCurrency(targetAllocationCents)}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="tablecell">
                        {opportunity.metrics.interestedCount ? (
                          <div>
                            {opportunity.metrics.interestedCount}{' '}
                            <span className="dimish">
                              {pluralize(opportunity.metrics.interestedCount, 'investor')}
                            </span>
                          </div>
                        ) : (
                          <div>-</div>
                        )}
                      </div>
                      <div className="tablecell">
                        {opportunity.metrics.viewedCount ? (
                          <div>
                            {opportunity.metrics.viewedCount}{' '}
                            <span className="dimish">
                              {pluralize(opportunity.metrics.viewedCount, 'time')}
                            </span>
                          </div>
                        ) : (
                          <div>-</div>
                        )}
                      </div>
                      <div className="tablecell actions">
                        <Link
                          href={`/admin/opportunities/${opportunity.slug}/edit`}
                          className="actionlinks w-inline-block"
                        >
                          <div>View / Edit</div>
                        </Link>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="tablerow">
                  <div className="tablecell first">
                    <div>No opportunities yet.</div>
                  </div>
                  <div className="tablecell">
                    <div>-</div>
                  </div>
                  <div className="tablecell">
                    <div>-</div>
                  </div>
                  <div className="tablecell">
                    <div>-</div>
                  </div>
                  <div className="tablecell actions">
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
