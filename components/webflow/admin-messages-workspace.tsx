'use client';

import Link from 'next/link';
import { Suspense, useMemo, useState } from 'react';

import { AdminListPagination } from '@/components/webflow/admin-list-pagination';
import type { ActivityFilterOption } from '@/lib/admin/activity-filter-options';
import type { MessageFeedRow, MessageFeedType } from '@/lib/admin/messages-feed';
import { formatMessageRelativeTime } from '@/lib/admin/messages-feed';

function NewOpportunityIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" className="pillicon">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatusChangeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" className="pillicon">
      <path
        d="M4 7h11M4 12h16M4 17h9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m15 4 4 3-4 3M9 14l-4 3 4 3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FollowerUpdateIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" className="pillicon">
      <path
        d="M4 4h16v12H5.17L4 17.17V4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 8h8M8 12h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SignupReceivedIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" className="pillicon">
      <path
        d="M4 6h16v12H4z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

function NdaCopyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" className="pillicon">
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6M9 15h6M9 11h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const MESSAGE_ICONS = {
  new_opportunity: NewOpportunityIcon,
  status_change: StatusChangeIcon,
  follower_update: FollowerUpdateIcon,
  signup_received: SignupReceivedIcon,
  approved: ApprovedIcon,
  nda_copy: NdaCopyIcon,
} as const;

const MESSAGE_TYPE_FILTERS: { type: MessageFeedType; label: string }[] = [
  { type: 'new_opportunity', label: 'New Opportunity' },
  { type: 'status_change', label: 'Status Change' },
  { type: 'follower_update', label: 'Update' },
  { type: 'signup_received', label: 'Signup' },
  { type: 'approved', label: 'Approved' },
  { type: 'nda_copy', label: 'NDA Copy' },
];

function buildOpportunityLink(row: MessageFeedRow) {
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

function buildMessageDescription(row: MessageFeedRow) {
  const opportunityLink = buildOpportunityLink(row);

  switch (row.type) {
    case 'new_opportunity':
      return <>Emailed about new opportunity {opportunityLink}</>;
    case 'status_change':
      return (
        <>
          Emailed status change
          {row.newStatus ? ` to ${row.newStatus}` : ''}
          {opportunityLink ? <> for {opportunityLink}</> : null}
        </>
      );
    case 'follower_update':
      return <>Emailed an update{opportunityLink ? <> on {opportunityLink}</> : null}</>;
    case 'signup_received':
      return <>Emailed signup confirmation</>;
    case 'approved':
      return <>Emailed approval notice</>;
    case 'nda_copy':
      return <>Emailed signed copy of {row.ndaName ?? 'NDA'}</>;
  }
}

function MessageFilterPill({
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

function MessageFilterDropdown({
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

export function AdminMessagesWorkspace({
  messageRows,
  opportunityOptions,
  investorOptions,
  page,
  totalCount,
  totalPages,
}: {
  messageRows: MessageFeedRow[];
  opportunityOptions: ActivityFilterOption[];
  investorOptions: ActivityFilterOption[];
  page: number;
  totalCount: number;
  totalPages: number;
}) {
  const [selectedTypes, setSelectedTypes] = useState<MessageFeedType[]>([]);
  const [selectedOpportunityIds, setSelectedOpportunityIds] = useState<string[]>([]);
  const [selectedInvestorIds, setSelectedInvestorIds] = useState<string[]>([]);

  const visibleRows = useMemo(() => {
    return messageRows.filter((row) => {
      if (selectedTypes.length > 0 && !selectedTypes.includes(row.type)) {
        return false;
      }

      if (
        selectedOpportunityIds.length > 0
        && (!row.opportunityId || !selectedOpportunityIds.includes(row.opportunityId))
      ) {
        return false;
      }

      if (
        selectedInvestorIds.length > 0
        && (!row.investorId || !selectedInvestorIds.includes(row.investorId))
      ) {
        return false;
      }

      return true;
    });
  }, [messageRows, selectedInvestorIds, selectedOpportunityIds, selectedTypes]);

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

  function toggleType(type: MessageFeedType) {
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
          <div className="pagetitle">Messages</div>
        </div>
        <div className="contenttable speevy-activity-table speevy-responsive-table">
          <div className="tablerow headerrow">
            <div className="tablecell first long">
              <div>Message</div>
            </div>
          </div>
          {visibleRows.length ? (
            visibleRows.map((row) => {
              const Icon = MESSAGE_ICONS[row.type];
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
                          {formatMessageRelativeTime(row.occurredAt)}
                        </span>
                      </div>
                      <div className="activitysubtext">
                        {buildMessageDescription(row)}
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
                    ? 'No messages yet. LP emails will appear here after they are sent.'
                    : hasFilters
                      ? 'No messages match the selected filters.'
                      : 'No messages yet. LP emails will appear here after they are sent.'}
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
              <div className="sideheading">By Message Type</div>
              <div className="sidesubheading">Filter by the type of email sent</div>
            </div>
            <div className="alignrow wrap">
              {MESSAGE_TYPE_FILTERS.map(({ type, label }) => {
                const Icon = MESSAGE_ICONS[type];
                const selected = selectedTypes.includes(type);

                return (
                  <MessageFilterPill
                    key={type}
                    label={label}
                    selected={selected}
                    onToggle={() => toggleType(type)}
                  >
                    <div className="pillicon-block">
                      <Icon />
                    </div>
                  </MessageFilterPill>
                );
              })}
            </div>
          </div>
          <div className="cardblock">
            <div>
              <div className="sideheading">By Opportunity</div>
              <div className="sidesubheading">Filter by the related opportunity</div>
            </div>
            <div className="speevy-activity-filter-group">
              <MessageFilterDropdown
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
              <MessageFilterDropdown
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
