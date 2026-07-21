import Link from 'next/link';
import { Suspense } from 'react';

import {
  AdminOpportunitiesStatusFilter,
  type OpportunityStatusFilterValue,
} from '@/components/webflow/admin-opportunities-status-filter';
import { AdminListPagination } from '@/components/webflow/admin-list-pagination';
import type { OpportunityStatus } from '@/lib/opportunity/opportunity-status-labels';
import {
  DEFAULT_PAGE_SIZE,
  paginateArray,
  parsePageParam,
} from '@/lib/pagination';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

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

type SortDirection = 'asc' | 'desc';
type SortField = 'interest' | 'interested' | 'viewed';
type OpportunitySort = {
  field: SortField;
  direction: SortDirection;
};

const statusLabels: Record<OpportunityStatus, string> = {
  active: 'Active',
  potential: 'Potential',
  upcoming: 'Upcoming',
  draft: 'Draft',
  closed: 'Closed',
};

const statusClasses: Record<OpportunityStatus, string> = {
  active: 'cellstatus',
  potential: 'cellstatus potential',
  upcoming: 'cellstatus potential',
  draft: 'cellstatus draft',
  closed: 'cellstatus closed',
};

// Admins want live deals first, then upcoming, then archived. Draft is slotted
// with the not-yet-live group so Closed stays last as requested.
const statusSortOrder: Record<OpportunityStatus, number> = {
  active: 0,
  potential: 1,
  upcoming: 1,
  draft: 2,
  closed: 3,
};

const sortFields: SortField[] = ['interest', 'interested', 'viewed'];

function centsToNumber(value: number | string | null) {
  if (value === null) {
    return 0;
  }

  return Number(value);
}

function getOpportunitySort(value: string | string[] | undefined): OpportunitySort | null {
  const sort = Array.isArray(value) ? value[0] : value;

  if (!sort) {
    return null;
  }

  for (const field of sortFields) {
    if (sort === `${field}_asc` || sort === `${field}_desc`) {
      return {
        field,
        direction: sort === `${field}_asc` ? 'asc' : 'desc',
      };
    }
  }

  return null;
}

function sortHref(
  field: SortField,
  sort: OpportunitySort | null,
  statusFilter: OpportunityStatusFilterValue,
) {
  const nextDirection: SortDirection =
    sort?.field === field && sort.direction === 'desc' ? 'asc' : 'desc';
  const params = new URLSearchParams();

  params.set('sort', `${field}_${nextDirection}`);

  if (statusFilter !== 'all') {
    params.set('status', statusFilter);
  }

  return `/admin/opportunities?${params.toString()}`;
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

const opportunityStatuses = ['active', 'potential', 'upcoming', 'draft', 'closed'] as const;

function parseStatusFilter(value: string | string[] | undefined): OpportunityStatusFilterValue {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) {
    return 'all';
  }

  for (const status of opportunityStatuses) {
    if (status === raw) {
      return status;
    }
  }

  return 'all';
}

export default async function AdminOpportunitiesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    page?: string | string[];
    status?: string | string[];
    sort?: string | string[];
  }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const statusFilter = parseStatusFilter(resolvedSearchParams.status);
  const page = parsePageParam(resolvedSearchParams.page);
  const opportunitySort = getOpportunitySort(resolvedSearchParams.sort);
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
    .filter((opportunity) => statusFilter === 'all' || opportunity.status === statusFilter)
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

  if (opportunitySort) {
    const direction = opportunitySort.direction === 'asc' ? 1 : -1;

    rows.sort((a, b) => {
      const aValue =
        opportunitySort.field === 'interest'
          ? a.metrics.interestAmountCents
          : opportunitySort.field === 'interested'
            ? a.metrics.interestedCount
            : a.metrics.viewedCount;
      const bValue =
        opportunitySort.field === 'interest'
          ? b.metrics.interestAmountCents
          : opportunitySort.field === 'interested'
            ? b.metrics.interestedCount
            : b.metrics.viewedCount;

      if (aValue === bValue) {
        return a.title.localeCompare(b.title);
      }

      return (aValue - bValue) * direction;
    });
  }

  const paginated = paginateArray(rows, page, DEFAULT_PAGE_SIZE);
  const pageRows = paginated.rows;

  return (
    <div className="pagecontainer">
      <div className="pagecontent">
        <div className="pagemain">
          <div>
            <div className="tableheader">
              <div className="pagetitle">Manage Opportunities</div>
              <div className="speevy-tableheader-actions">
                <Suspense fallback={null}>
                  <AdminOpportunitiesStatusFilter value={statusFilter} />
                </Suspense>
                <Link
                  href="/admin/opportunities/new"
                  className="button short w-inline-block"
                >
                  <div>Create New</div>
                </Link>
              </div>
            </div>
            <div className="contenttable speevy-responsive-table">
              <div className="tablerow headerrow">
                <div className="tablecell first">
                  <div className="interestchecks-row spacing">
                    <div className="checkboxtoggle sm" />
                  </div>
                  <div>Opportunity</div>
                </div>
                <Link
                  href={sortHref('interest', opportunitySort, statusFilter)}
                  className="tablecell speevy-sort-cell"
                  aria-label="Sort opportunities by interest value"
                  aria-current={opportunitySort?.field === 'interest' ? 'true' : undefined}
                >
                  <span className="speevy-table-sort-button">
                    <span>Interest Value</span>
                    <span className="speevy-sort-indicator">
                      {opportunitySort?.field === 'interest'
                        ? opportunitySort.direction === 'desc'
                          ? '↓'
                          : '↑'
                        : '↕'}
                    </span>
                  </span>
                </Link>
                <Link
                  href={sortHref('interested', opportunitySort, statusFilter)}
                  className="tablecell speevy-sort-cell"
                  aria-label="Sort opportunities by interested investors"
                  aria-current={opportunitySort?.field === 'interested' ? 'true' : undefined}
                >
                  <span className="speevy-table-sort-button">
                    <span>Interested</span>
                    <span className="speevy-sort-indicator">
                      {opportunitySort?.field === 'interested'
                        ? opportunitySort.direction === 'desc'
                          ? '↓'
                          : '↑'
                        : '↕'}
                    </span>
                  </span>
                </Link>
                <Link
                  href={sortHref('viewed', opportunitySort, statusFilter)}
                  className="tablecell speevy-sort-cell"
                  aria-label="Sort opportunities by views"
                  aria-current={opportunitySort?.field === 'viewed' ? 'true' : undefined}
                >
                  <span className="speevy-table-sort-button">
                    <span>Viewed</span>
                    <span className="speevy-sort-indicator">
                      {opportunitySort?.field === 'viewed'
                        ? opportunitySort.direction === 'desc'
                          ? '↓'
                          : '↑'
                        : '↕'}
                    </span>
                  </span>
                </Link>
                <div className="tablecell actions">
                  <div>Actions</div>
                </div>
              </div>
              {pageRows.length ? (
                pageRows.map((opportunity) => {
                  const targetAllocationCents = centsToNumber(opportunity.target_allocation_cents);
                  const interestAmountCents = opportunity.metrics.interestAmountCents;
                  const hasTarget = targetAllocationCents > 0;
                  const hasInterest = interestAmountCents > 0;
                  const interestPercent = hasTarget
                    ? Math.round((interestAmountCents / targetAllocationCents) * 100)
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
                        {!hasTarget && !hasInterest ? (
                          <div>-</div>
                        ) : hasTarget ? (
                          <div className="interestrow">
                            <div className="interestbar">
                              <div
                                className="interestprogress"
                                style={{ width: `${progressWidth}%` }}
                              >
                                <div className="percentinterest">{interestPercent}%</div>
                              </div>
                              <div className="dollarinterest">
                                {formatCompactCurrency(interestAmountCents)}{' '}
                                <span className="dollarinterest-of">of</span>{' '}
                                {formatCompactCurrency(targetAllocationCents)}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div>{formatCompactCurrency(interestAmountCents)}</div>
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
            <Suspense fallback={null}>
              <AdminListPagination page={paginated.page} totalPages={paginated.totalPages} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
