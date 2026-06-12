'use client';

import Link from 'next/link';
import { Suspense, useMemo, useState } from 'react';

import { AdminListPagination } from '@/components/webflow/admin-list-pagination';

import type { ActivityFeedRow, ActivityFeedType } from '@/lib/admin/activity-feed';
import { formatActivityRelativeTime } from '@/lib/admin/activity-feed';
import type { ActivityFilterOption } from '@/lib/admin/activity-filter-options';

function ViewedIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      className="pillicon"
    >
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1 12C1 12 5 20 12 20C19 20 23 12 23 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InterestIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" className="pillicon">
      <path
        d="M11.8001 10.9C9.53007 10.31 8.80007 9.7 8.80007 8.75C8.80007 7.66 9.81007 6.9 11.5001 6.9C13.2801 6.9 13.9401 7.75 14.0001 9H16.2101C16.1401 7.28 15.0901 5.7 13.0001 5.19V3H10.0001V5.16C8.06007 5.58 6.50007 6.84 6.50007 8.77C6.50007 11.08 8.41007 12.23 11.2001 12.9C13.7001 13.5 14.2001 14.38 14.2001 15.31C14.2001 16 13.7101 17.1 11.5001 17.1C9.44007 17.1 8.63007 16.18 8.52007 15H6.32007C6.44007 17.19 8.08007 18.42 10.0001 18.83V21H13.0001V18.85C14.9501 18.48 16.5001 17.35 16.5001 15.3C16.5001 12.46 14.0701 11.49 11.8001 10.9Z"
        fill="currentColor"
      />
    </svg>
  );
}

function JoinedIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 1024 1024" className="pillicon">
      <path
        fill="currentColor"
        d="M892 772h-80v-80c0-4.4-3.6-8-8-8h-48c-4.4 0-8 3.6-8 8v80h-80c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8h80v80c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8v-80h80c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8zM373.5 498.4c-.9-8.7-1.4-17.5-1.4-26.4 0-15.9 1.5-31.4 4.3-46.5.7-3.6-1.2-7.3-4.5-8.8-13.6-6.1-26.1-14.5-36.9-25.1a127.54 127.54 0 0 1-38.7-95.4c.9-32.1 13.8-62.6 36.3-85.6 24.7-25.3 57.9-39.1 93.2-38.7 31.9.3 62.7 12.6 86 34.4 7.9 7.4 14.7 15.6 20.4 24.4 2 3.1 5.9 4.4 9.3 3.2 17.6-6.1 36.2-10.4 55.3-12.4 5.6-.6 8.8-6.6 6.3-11.6-32.5-64.3-98.9-108.7-175.7-109.9-110.8-1.7-203.2 89.2-203.2 200 0 62.8 28.9 118.8 74.2 155.5-31.8 14.7-61.1 35-86.5 60.4-54.8 54.7-85.8 126.9-87.8 204a8 8 0 0 0 8 8.2h56.1c4.3 0 7.9-3.4 8-7.7 1.9-58 25.4-112.3 66.7-153.5 29.4-29.4 65.4-49.8 104.7-59.7 3.8-1.1 6.4-4.8 5.9-8.8zM824 472c0-109.4-87.9-198.3-196.9-200C516.3 270.3 424 361.2 424 472c0 62.8 29 118.8 74.2 155.5a300.95 300.95 0 0 0-86.4 60.4C357 742.6 326 814.8 324 891.8a8 8 0 0 0 8 8.2h56c4.3 0 7.9-3.4 8-7.7 1.9-58 25.4-112.3 66.7-153.5C505.8 695.7 563 672 624 672c110.4 0 200-89.5 200-200zm-109.5 90.5C690.3 586.7 658.2 600 624 600s-66.3-13.3-90.5-37.5a127.26 127.26 0 0 1-37.5-91.8c.3-32.8 13.4-64.5 36.3-88 24-24.6 56.1-38.3 90.4-38.7 33.9-.3 66.8 12.9 91 36.6 24.8 24.3 38.4 56.8 38.4 91.4-.1 34.2-13.4 66.3-37.6 90.5z"
      />
    </svg>
  );
}

function SignedIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" className="pillicon">
      <path
        d="M4.5 13.5L14.5 3.5C15.3284 2.67157 16.6716 2.67157 17.5 3.5C18.3284 4.32843 18.3284 5.67157 17.5 6.5L7.5 16.5L3.5 17.5L4.5 13.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="3" y1="21" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ApprovedIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" className="pillicon">
      <path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ACTIVITY_ICONS = {
  viewed: ViewedIcon,
  interest: InterestIcon,
  joined: JoinedIcon,
  approved: ApprovedIcon,
  signed: SignedIcon,
} as const;

const ACTIVITY_TYPE_FILTERS: { type: ActivityFeedType; label: string }[] = [
  { type: 'viewed', label: 'Viewed' },
  { type: 'interest', label: 'Interest' },
  { type: 'joined', label: 'Joined' },
  { type: 'signed', label: 'Signed' },
];

function buildOpportunityLink(row: ActivityFeedRow) {
  if (!row.opportunityTitle) {
    return null;
  }

  if (row.opportunitySlug) {
    return (
      <Link
        href={`/admin/opportunities/${row.opportunitySlug}/edit`}
        className="activitylink"
      >
        {row.opportunityTitle}
      </Link>
    );
  }

  return <span>{row.opportunityTitle}</span>;
}

function buildActivityDescription(row: ActivityFeedRow) {
  const opportunityLink = buildOpportunityLink(row);

  switch (row.type) {
    case 'viewed':
      return <>Viewed {opportunityLink}</>;
    case 'interest':
      return <>Showed interest in {opportunityLink}</>;
    case 'joined':
      return <>Joined the platform</>;
    case 'approved':
      return <>Approved as an insider</>;
    case 'signed':
      return <>Signed {row.ndaLabel ?? 'NDA'}</>;
  }
}

function ActivityFilterPill({
  label,
  selected,
  onToggle,
  children,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`pillstat _5 activity-filter-pill${selected ? ' selected' : ''}`}
      aria-pressed={selected}
      onClick={onToggle}
    >
      {children}
      <div>{label}</div>
    </button>
  );
}

function ActivityFilterDropdown({
  placeholder,
  options,
  selectedIds,
  onSelect,
}: {
  placeholder: string;
  options: ActivityFilterOption[];
  selectedIds: string[];
  onSelect: (id: string) => void;
}) {
  const availableOptions = options.filter((option) => !selectedIds.includes(option.id));

  return (
    <div className="fieldblock speevy-activity-filter-field">
      <select
        className="textfield w-input"
        value=""
        disabled={availableOptions.length === 0}
        onChange={(event) => {
          const nextId = event.target.value;
          if (nextId) {
            onSelect(nextId);
          }
        }}
      >
        <option value="">
          {availableOptions.length ? placeholder : 'No more options'}
        </option>
        {availableOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SelectedFilterPill({
  label,
  selected,
  onToggle,
  children,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`pillstat _5 activity-filter-pill${selected ? ' selected' : ''}`}
      aria-pressed={selected}
      aria-label={`Remove ${label} filter`}
      onClick={onToggle}
    >
      {children}
      <div>{label}</div>
    </button>
  );
}

export function AdminActivityWorkspace({
  activityRows,
  opportunityOptions,
  investorOptions,
  page,
  totalCount,
  totalPages,
}: {
  activityRows: ActivityFeedRow[];
  opportunityOptions: ActivityFilterOption[];
  investorOptions: ActivityFilterOption[];
  page: number;
  totalCount: number;
  totalPages: number;
}) {
  const [selectedTypes, setSelectedTypes] = useState<ActivityFeedType[]>([]);
  const [selectedOpportunityIds, setSelectedOpportunityIds] = useState<string[]>([]);
  const [selectedInvestorIds, setSelectedInvestorIds] = useState<string[]>([]);

  const visibleRows = useMemo(() => {
    return activityRows.filter((row) => {
      if (selectedTypes.length > 0 && !selectedTypes.includes(row.type)) {
        return false;
      }

      if (
        selectedOpportunityIds.length > 0
        && row.opportunityId
        && !selectedOpportunityIds.includes(row.opportunityId)
      ) {
        return false;
      }

      if (
        selectedInvestorIds.length > 0
        && row.investorId
        && !selectedInvestorIds.includes(row.investorId)
      ) {
        return false;
      }

      return true;
    });
  }, [activityRows, selectedInvestorIds, selectedOpportunityIds, selectedTypes]);

  const selectedOpportunities = opportunityOptions.filter((option) =>
    selectedOpportunityIds.includes(option.id),
  );
  const selectedInvestors = investorOptions.filter((option) =>
    selectedInvestorIds.includes(option.id),
  );

  const hasFilters =
    selectedTypes.length > 0
    || selectedOpportunityIds.length > 0
    || selectedInvestorIds.length > 0;

  function toggleType(type: ActivityFeedType) {
    setSelectedTypes((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type],
    );
  }

  function addOpportunityFilter(id: string) {
    setSelectedOpportunityIds((current) =>
      current.includes(id) ? current : [...current, id],
    );
  }

  function removeOpportunityFilter(id: string) {
    setSelectedOpportunityIds((current) => current.filter((item) => item !== id));
  }

  function addInvestorFilter(id: string) {
    setSelectedInvestorIds((current) =>
      current.includes(id) ? current : [...current, id],
    );
  }

  function removeInvestorFilter(id: string) {
    setSelectedInvestorIds((current) => current.filter((item) => item !== id));
  }

  return (
    <div className="pagecontent">
      <div className="pagemain nogap">
        <div className="tableheader speevy-activity-header">
          <div className="pagetitle">Activity Feed</div>
        </div>
        <div className="contenttable speevy-activity-table speevy-responsive-table">
          <div className="tablerow headerrow">
            <div className="tablecell first long">
              <div>Activity</div>
            </div>
          </div>
          {visibleRows.length ? (
            visibleRows.map((row) => {
              const Icon = ACTIVITY_ICONS[row.type];
              const investorHref = row.investorId
                ? `/admin/investors?investor=${row.investorId}`
                : '/admin/investors';

              return (
                <div className="tablerow" key={row.id}>
                  <div className="tablecell first long">
                    <div className="speevy-activity-type-icon" aria-hidden="true">
                      <Icon />
                    </div>
                    <div>
                      <div className="cellname">
                        {row.investorName}{' '}
                        <span className="dimsmaller">
                          {formatActivityRelativeTime(row.occurredAt)}
                        </span>
                      </div>
                      <div className="activitysubtext">
                        {buildActivityDescription(row)}
                      </div>
                    </div>
                  </div>
                  <div className="tablecell actions">
                    <Link href={investorHref} className="actionlinks w-inline-block">
                      <div>View Investor</div>
                    </Link>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="tablerow">
              <div className="tablecell first long">
                <div className="dimish">
                  {totalCount === 0
                    ? 'No activity yet.'
                    : hasFilters
                      ? 'No activity matches the selected filters.'
                      : 'No activity yet.'}
                </div>
              </div>
              <div className="tablecell actions" />
            </div>
          )}
        </div>
        <Suspense fallback={null}>
          <AdminListPagination page={page} totalPages={totalPages} />
        </Suspense>
      </div>
      <div className="pageside">
        <div className="pagecard sidecard">
          <div className="cardblock">
            <div className="cardtitle-row">
              <div className="sideheading large">Filters</div>
            </div>
          </div>
          <div className="cardblock">
            <div>
              <div className="sideheading">By Activity Type</div>
              <div className="sidesubheading">Filter by the type of activity</div>
            </div>
            <div className="alignrow wrap">
              {ACTIVITY_TYPE_FILTERS.map(({ type, label }) => {
                const Icon = ACTIVITY_ICONS[type];
                const selected = selectedTypes.includes(type);

                return (
                  <ActivityFilterPill
                    key={type}
                    label={label}
                    selected={selected}
                    onToggle={() => toggleType(type)}
                  >
                    <div className="pillicon-block">
                      <Icon />
                    </div>
                  </ActivityFilterPill>
                );
              })}
            </div>
          </div>
          <div className="cardblock">
            <div>
              <div className="sideheading">By Opportunity</div>
              <div className="sidesubheading">Filter by the opportunity being engaged with</div>
            </div>
            <div className="speevy-activity-filter-group">
              <ActivityFilterDropdown
                placeholder="Select an opportunity"
                options={opportunityOptions}
                selectedIds={selectedOpportunityIds}
                onSelect={addOpportunityFilter}
              />
              {selectedOpportunities.length ? (
                <div className="alignrow wrap">
                  {selectedOpportunities.map((option) => (
                    <SelectedFilterPill
                      key={option.id}
                      label={option.label}
                      selected
                      onToggle={() => removeOpportunityFilter(option.id)}
                    >
                      <div className="pillicon-block">
                        {option.imageUrl ? (
                          <img alt="" src={option.imageUrl} loading="lazy" className="fullimage" />
                        ) : (
                          <div className="dimsmall">{option.label.slice(0, 1).toUpperCase()}</div>
                        )}
                      </div>
                    </SelectedFilterPill>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="cardblock">
            <div>
              <div className="sideheading">By Investor</div>
            </div>
            <div className="speevy-activity-filter-group">
              <ActivityFilterDropdown
                placeholder="Select an investor"
                options={investorOptions}
                selectedIds={selectedInvestorIds}
                onSelect={addInvestorFilter}
              />
              {selectedInvestors.length ? (
                <div className="alignrow wrap">
                  {selectedInvestors.map((option) => (
                    <SelectedFilterPill
                      key={option.id}
                      label={option.label}
                      selected
                      onToggle={() => removeInvestorFilter(option.id)}
                    >
                      <div className="pillicon-block">
                        {option.imageUrl ? (
                          <img alt="" src={option.imageUrl} loading="lazy" className="fullimage" />
                        ) : (
                          <div className="dimsmall">{option.label.slice(0, 1).toUpperCase()}</div>
                        )}
                      </div>
                    </SelectedFilterPill>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
