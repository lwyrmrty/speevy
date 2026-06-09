'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
  bulkApproveInvestors,
  getInvestorSignedNdaUrl,
  updateInvestor,
  type UpdateInvestorResult,
} from '@/app/admin/investors/actions';
import { CopyInvestorNdaLinkButton } from '@/components/webflow/copy-investor-nda-link-button';
import { AdminInvestorProfilePictureUpload } from '@/components/webflow/admin-investor-profile-picture-upload';
import { InvestorProfileSquare } from '@/components/webflow/investor-profile-square';
import { Badge } from '@/components/base/badges/badges';
import type { BadgeColors } from '@/components/base/badges/badge-types';
import { LpTagBadge, LpTagEditor } from '@/components/webflow/lp-tag-editor';
import { WebflowSectorIcon } from '@/components/webflow/sector-icon';
import {
  type InvestorSector,
} from '@/lib/investor-request';
import { type Tag } from '@/lib/lp-tags';

export type SignedNdaItem = {
  id: string;
  tier: 'account' | 'opportunity';
  label: string;
  status: string;
  signedAt: string | null;
  hasDocument: boolean;
};

export type AdminInvestorRow = {
  id: string;
  email: string;
  fullName: string | null;
  entityName: string | null;
  status: 'invited' | 'onboarding' | 'pending_review' | 'approved' | 'rejected' | 'removed' | 'outsider';
  kind: 'insider' | 'outsider';
  sectors: InvestorSector[];
  investmentRangeMin: number | null;
  investmentRangeMax: number | null;
  joinedAt: string;
  interestedCount: number;
  interestedOpportunityTitles: string[];
  interestedOpportunities: {
    title: string;
    amountCents: number | string | null;
    logoUrl: string | null;
  }[];
  tags: Tag[];
  // Derived account-NDA status (no new lps column): 'signed' | 'pending', or
  // null when no account NDA has been sent yet.
  accountNda: { status: 'signed' | 'pending'; signedAt: string | null } | null;
  // Account + per-opportunity NDAs for the profile drawer's "Signed NDAs" list.
  signedNdas: SignedNdaItem[];
  profilePictureUrl: string | null;
};

const statusLabels: Record<AdminInvestorRow['status'], string> = {
  invited: 'Invited',
  onboarding: 'Onboarding',
  pending_review: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  removed: 'Removed',
  outsider: 'Outsider',
};

function kindLabel(kind: AdminInvestorRow['kind']) {
  return kind === 'outsider' ? 'Outsider' : 'Insider';
}

function kindBadgeColor(kind: AdminInvestorRow['kind']): BadgeColors {
  return kind === 'outsider' ? 'gray' : 'success';
}

function KindBadge({ kind }: { kind: AdminInvestorRow['kind'] }) {
  return (
    <Badge type="pill-color" size="sm" color={kindBadgeColor(kind)}>
      {kindLabel(kind)}
    </Badge>
  );
}

// Collapses the underlying LP lifecycle status into the two states admins
// care about on this page (approved vs. still pending), keeping "Rejected"
// distinct so a rejected investor is never mislabeled as merely pending.
function insiderStatusBadge(status: AdminInvestorRow['status']): {
  label: string;
  color: BadgeColors;
  ariaLabel: string;
} {
  if (status === 'approved') {
    return { label: 'Insider', color: 'success', ariaLabel: 'Insider, approved' };
  }

  if (status === 'rejected') {
    return { label: 'Insider', color: 'error', ariaLabel: 'Insider, rejected' };
  }

  if (status === 'removed') {
    return { label: 'Insider', color: 'error', ariaLabel: 'Insider, removed' };
  }

  // invited | onboarding | pending_review
  return { label: 'Insider', color: 'warning', ariaLabel: 'Insider, pending' };
}

function InsiderStatusBadge({ status }: { status: AdminInvestorRow['status'] }) {
  const { label, color, ariaLabel } = insiderStatusBadge(status);

  return (
    <span role="status" aria-label={ariaLabel} title={ariaLabel}>
      <span aria-hidden="true">
        <Badge type="pill-color" size="sm" color={color}>
          {label}
        </Badge>
      </span>
    </span>
  );
}

function InvestorStatusBadge({ investor }: { investor: AdminInvestorRow }) {
  if (investor.kind === 'outsider') {
    return <KindBadge kind={investor.kind} />;
  }

  return <InsiderStatusBadge status={investor.status} />;
}

function accountNdaAriaLabel() {
  return 'NDA, pending';
}

function canCopyNdaLink(accountNda: AdminInvestorRow['accountNda']) {
  return !accountNda || accountNda.status !== 'signed';
}

// Derived account-NDA indicator. Only shown when an account NDA was sent but not signed yet.
function AccountNdaBadge({ accountNda }: { accountNda: AdminInvestorRow['accountNda'] }) {
  if (!accountNda || accountNda.status !== 'pending') {
    return null;
  }

  const ariaLabel = accountNdaAriaLabel();

  return (
    <span role="status" aria-label={ariaLabel} title={ariaLabel}>
      <span aria-hidden="true">
        <Badge type="pill-color" size="sm" color="warning">
          NDA
        </Badge>
      </span>
    </span>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="64"
      height="64"
      className="checkicon"
    >
      <g fill="none" fillRule="evenodd">
        <path
          fill="currentColor"
          d="M21.546 5.111a1.5 1.5 0 0 1 0 2.121L10.303 18.475a1.6 1.6 0 0 1-2.263 0L2.454 12.89a1.5 1.5 0 1 1 2.121-2.121l4.596 4.596L19.424 5.111a1.5 1.5 0 0 1 2.122 0Z"
        />
      </g>
    </svg>
  );
}

function compactDollarValue(cents: number | null) {
  if (!cents) return '';

  const dollars = cents / 100;
  if (dollars >= 1_000_000) {
    const millions = dollars / 1_000_000;
    return `$${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
  }

  if (dollars >= 1_000) {
    return `$${Math.round(dollars / 1_000)}k`;
  }

  return `$${dollars.toLocaleString('en-US')}`;
}

function formatCheckRange(minCents: number | null, maxCents: number | null) {
  const min = compactDollarValue(minCents);
  const max = compactDollarValue(maxCents);

  if (min && max) {
    return (
      <>
        {min} <span className="dimish">-</span> {max}
      </>
    );
  }

  if (min) return <>{min}+</>;
  if (max) return <>Up to {max}</>;
  return <span className="dimish">Not set</span>;
}

function formatInterestAmount(cents: number | string | null) {
  const amount = typeof cents === 'string' ? Number(cents) : cents;
  return compactDollarValue(amount);
}

function formatJoinedDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function SectorIconRow({ sectors }: { sectors: InvestorSector[] }) {
  const visibleSectors = sectors.slice(0, 4);
  const hiddenSectors = sectors.slice(4);
  const remainingCount = sectors.length - visibleSectors.length;

  if (sectors.length === 0) {
    return <div className="dimish">No sectors</div>;
  }

  return (
    <div className="alignrow wrap">
      {visibleSectors.map((sector) => (
        <div key={sector} className="speevy-tooltip" aria-label={sector}>
          <div className="sectoricon-block">
            <WebflowSectorIcon sector={sector} className="selecticon" />
          </div>
          <div className="speevy-tooltip-panel" role="tooltip">
            {sector}
          </div>
        </div>
      ))}
      {remainingCount > 0 ? (
        <div className="speevy-tooltip" aria-label={`${remainingCount} more sectors`}>
          <div className="sectoricon-block">
            <div>+{remainingCount}</div>
          </div>
          <div className="speevy-tooltip-panel" role="tooltip">
            {hiddenSectors.join(', ')}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InterestedOpportunitiesTooltip({ investor }: { investor: AdminInvestorRow }) {
  const countLabel = (
    <>
      {investor.interestedCount} <span className="dimish">
        {investor.interestedCount === 1 ? 'opportunity' : 'opportunities'}
      </span>
    </>
  );

  if (investor.interestedOpportunityTitles.length === 0) {
    return <div>{countLabel}</div>;
  }

  return (
    <div className="speevy-tooltip" aria-label={investor.interestedOpportunityTitles.join(', ')}>
      <div>{countLabel}</div>
      <div className="speevy-tooltip-panel speevy-tooltip-panel-list" role="tooltip">
        <div className="speevy-tooltip-title">Interested in</div>
        {investor.interestedOpportunityTitles.map((title) => (
          <div key={title} className="speevy-tooltip-list-item">
            {title}
          </div>
        ))}
      </div>
    </div>
  );
}

function InterestedOpportunitiesList({ opportunities }: { opportunities: AdminInvestorRow['interestedOpportunities'] }) {
  if (opportunities.length === 0) {
    return (
      <div className="speevy-interest-opportunity-empty">
        No interested opportunities yet.
      </div>
    );
  }

  return (
    <div className="speevy-interest-opportunity-list">
      {opportunities.map((opportunity) => {
        const amount = formatInterestAmount(opportunity.amountCents);

        return (
          <div key={opportunity.title} className="speevy-interest-opportunity-row">
            <div className="speevy-interest-opportunity-logo">
              <img
                src={opportunity.logoUrl ?? '/webflow/images/frontierSec.webp'}
                loading="lazy"
                alt=""
                className="fullimage"
              />
            </div>
            <div className="speevy-interest-opportunity-main">
              <div className="cellname">{opportunity.title}</div>
              <div className="dimsmall">
                {amount || 'No amount shared'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ndaStatusLabel(status: string) {
  if (status === 'signed') return 'Signed';
  if (status === 'declined') return 'Declined';
  if (status === 'expired') return 'Expired';
  if (status === 'viewed') return 'Viewed';
  return 'Pending';
}

// Read-only list of an investor's executed/in-flight NDAs (account + each
// per-opportunity). View/Download requests a short-lived signed URL on demand
// via an admin-only server action; the raw storage key is never exposed.
function SignedNdasSection({ ndas }: { ndas: SignedNdaItem[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleView(nda: SignedNdaItem) {
    setError(null);
    setPendingId(nda.id);
    startTransition(async () => {
      const result = await getInvestorSignedNdaUrl({ tier: nda.tier, ndaId: nda.id });
      setPendingId(null);
      if (result.status === 'success') {
        window.open(result.url, '_blank', 'noopener,noreferrer');
      } else {
        setError(result.message);
      }
    });
  }

  if (ndas.length === 0) {
    return <div className="dimish">No NDAs on file yet.</div>;
  }

  return (
    <div className="speevy-interest-opportunity-list">
      {ndas.map((nda) => (
        <div key={`${nda.tier}-${nda.id}`} className="speevy-interest-opportunity-row">
          <div className="speevy-interest-opportunity-main">
            <div className="cellname">{nda.label}</div>
            <div className="dimsmall">
              {nda.tier === 'account' ? 'Account NDA' : 'Opportunity NDA'} · {ndaStatusLabel(nda.status)}
              {nda.signedAt ? ` · ${formatJoinedDate(nda.signedAt)}` : ''}
            </div>
          </div>
          {nda.hasDocument ? (
            <button
              type="button"
              className="button short secondary w-inline-block"
              onClick={() => handleView(nda)}
              disabled={isPending && pendingId === nda.id}
            >
              <div>{isPending && pendingId === nda.id ? 'Opening…' : 'View / Download'}</div>
            </button>
          ) : (
            <div className="dimsmall">{ndaStatusLabel(nda.status)}</div>
          )}
        </div>
      ))}
      {error ? <div className="speevy-form-message error">{error}</div> : null}
    </div>
  );
}

function InvestorSlideout({
  investor,
  allTags,
  onClose,
  onSaved,
  onTagsChanged,
}: {
  investor: AdminInvestorRow;
  allTags: Tag[];
  onClose: () => void;
  onSaved: () => void;
  onTagsChanged: () => void;
}) {
  const [fullName, setFullName] = useState(investor.fullName ?? '');
  const [entityName, setEntityName] = useState(investor.entityName ?? '');
  const [status, setStatus] = useState<AdminInvestorRow['status']>(investor.status);
  const [message, setMessage] = useState<UpdateInvestorResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const hasChanges = fullName.trim() !== (investor.fullName ?? '').trim()
    || entityName.trim() !== (investor.entityName ?? '').trim()
    || status !== investor.status;

  function handleSubmit(formData: FormData) {
    if (!hasChanges) return;

    investor.sectors.forEach((sector) => formData.append('sectors', sector));
    if (investor.investmentRangeMin !== null) {
      formData.set('investmentRangeMin', String(Math.round(investor.investmentRangeMin / 100)));
    }
    if (investor.investmentRangeMax !== null) {
      formData.set('investmentRangeMax', String(Math.round(investor.investmentRangeMax / 100)));
    }
    startTransition(async () => {
      const result = await updateInvestor(formData);
      setMessage(result);

      if (result.status === 'success') {
        onSaved();
      }
    });
  }

  return (
    <div className="speevy-slideout-layer" role="dialog" aria-modal="true" aria-label="Edit investor">
      <button type="button" className="speevy-slideout-backdrop" aria-label="Close investor drawer" onClick={onClose} />
      <div className="speevy-slideout-panel">
        <div className="speevy-slideout-header">
          <div>
            <div className="pagetitle small">{investor.fullName || investor.email}</div>
            <div className="dimsmall">{investor.email}</div>
            <div className="alignrow aligncenter" style={{ gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
              <InvestorStatusBadge investor={investor} />
              <AccountNdaBadge accountNda={investor.accountNda} />
            </div>
            <div className="speevy-slideout-stats">
              <div className="speevy-slideout-stat">
                <span>Joined</span>
                <strong>{formatJoinedDate(investor.joinedAt)}</strong>
              </div>
              <div className="speevy-slideout-stat">
                <span>Interested In</span>
                <strong>
                  {investor.interestedCount} {investor.interestedCount === 1 ? 'Opportunity' : 'Opportunities'}
                </strong>
              </div>
            </div>
          </div>
          <button type="button" className="speevy-slideout-close" aria-label="Close" onClick={onClose}>
            <div>×</div>
          </button>
        </div>

        <form action={handleSubmit} className="speevy-slideout-body">
          <input type="hidden" name="id" value={investor.id} />

          <div className="fieldblock">
            <AdminInvestorProfilePictureUpload
              lpId={investor.id}
              fullName={fullName || investor.fullName}
              email={investor.email}
              initialPhotoUrl={investor.profilePictureUrl}
              onUploaded={onSaved}
            />
          </div>

          <div className="fieldblock">
            <label htmlFor="Investor-Status" className="fieldlabel">Status</label>
            <select
              id="Investor-Status"
              name="status"
              className="textfield w-input"
              value={status}
              onChange={(event) => {
                setMessage(null);
                setStatus(event.target.value as AdminInvestorRow['status']);
              }}
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="fieldblock">
            <div className="fieldlabel">Opportunities Interested</div>
            <InterestedOpportunitiesList opportunities={investor.interestedOpportunities} />
          </div>

          <div className="fieldblock">
            <label htmlFor="Investor-Full-Name" className="fieldlabel">Name</label>
            <input
              id="Investor-Full-Name"
              className="textfield w-input"
              maxLength={256}
              name="fullName"
              type="text"
              value={fullName}
              onChange={(event) => {
                setMessage(null);
                setFullName(event.target.value);
              }}
            />
          </div>

          <div className="fieldblock">
            <label htmlFor="Investor-Entity" className="fieldlabel">Entity / Fund</label>
            <input
              id="Investor-Entity"
              className="textfield w-input"
              maxLength={256}
              name="entityName"
              type="text"
              value={entityName}
              onChange={(event) => {
                setMessage(null);
                setEntityName(event.target.value);
              }}
            />
          </div>

          <div className="fieldblock">
            <div className="fieldlabel">Sectors Interested</div>
            <div className="pillswrapper">
              {investor.sectors.length > 0 ? (
                investor.sectors.map((sector) => (
                  <div key={sector} className="selectpill selected w-inline-block">
                    <div className="alignrow aligncenter">
                      <div className="selectlink-icon selected">
                        <WebflowSectorIcon sector={sector} />
                      </div>
                      <div>{sector}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="dimish">No sectors selected.</div>
              )}
            </div>
          </div>

          <div className="fieldblock">
            <div className="fieldlabel">Tags</div>
            <LpTagEditor
              lpId={investor.id}
              assignedTags={investor.tags}
              allTags={allTags}
              onChanged={onTagsChanged}
            />
          </div>

          <div className="fieldblock">
            <div className="fieldlabel">Signed NDAs</div>
            {canCopyNdaLink(investor.accountNda) ? (
              <div className="speevy-slideout-inline-action" style={{ marginBottom: '12px' }}>
                <CopyInvestorNdaLinkButton
                  lpId={investor.id}
                  className="button short secondary w-inline-block"
                />
              </div>
            ) : null}
            <SignedNdasSection ndas={investor.signedNdas} />
          </div>

          <div className="fieldrow">
            <div className="fieldblock">
              <div className="fieldlabel">Min Check</div>
              <div className="textfield readonly">{formatCheckRange(investor.investmentRangeMin, null)}</div>
            </div>
            <div className="fieldblock">
              <div className="fieldlabel">Max Check</div>
              <div className="textfield readonly">{formatCheckRange(null, investor.investmentRangeMax)}</div>
            </div>
          </div>

          {message ? (
            <div className={`speevy-form-message ${message.status}`}>
              {message.message}
            </div>
          ) : null}

          <div className="speevy-slideout-actions">
            <button type="button" className="button short secondary w-inline-block" onClick={onClose}>
              <div>Cancel</div>
            </button>
            <button type="submit" className="button short w-inline-block" disabled={isPending || !hasChanges}>
              <div>{isPending ? 'Saving...' : 'Save Changes'}</div>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AdminInvestorsTable({
  investors,
  allTags,
  initialSelectedInvestorId,
}: {
  investors: AdminInvestorRow[];
  allTags: Tag[];
  initialSelectedInvestorId?: string | null;
}) {
  const router = useRouter();
  const [selectedInvestorId, setSelectedInvestorId] = useState<string | null>(
    initialSelectedInvestorId && investors.some((investor) => investor.id === initialSelectedInvestorId)
      ? initialSelectedInvestorId
      : null,
  );
  const [selectedInvestorIds, setSelectedInvestorIds] = useState<string[]>([]);
  const [sort, setSort] = useState<{
    field: 'interestedCount' | 'investmentRangeMax';
    direction: 'desc' | 'asc';
  } | null>(null);
  const [bulkMessage, setBulkMessage] = useState<UpdateInvestorResult | null>(null);
  const [isBulkPending, startBulkTransition] = useTransition();
  const selectedInvestor = useMemo(
    () => investors.find((investor) => investor.id === selectedInvestorId) ?? null,
    [investors, selectedInvestorId],
  );
  const selectedInvestors = useMemo(
    () => investors.filter((investor) => selectedInvestorIds.includes(investor.id)),
    [investors, selectedInvestorIds],
  );
  const allInvestorsSelected = investors.length > 0 && selectedInvestorIds.length === investors.length;
  const canBulkApprove = selectedInvestors.length > 0
    && selectedInvestors.length === selectedInvestorIds.length
    && selectedInvestors.every((investor) => investor.status === 'pending_review');
  const visibleInvestors = useMemo(() => {
    if (!sort) return investors;

    return [...investors].sort((left, right) => {
      const direction = sort.direction === 'desc' ? -1 : 1;
      const leftValue = sort.field === 'interestedCount'
        ? left.interestedCount
        : left.investmentRangeMax ?? -1;
      const rightValue = sort.field === 'interestedCount'
        ? right.interestedCount
        : right.investmentRangeMax ?? -1;
      const valueDifference = leftValue - rightValue;

      if (valueDifference !== 0) {
        return valueDifference * direction;
      }

      return 0;
    });
  }, [sort, investors]);

  useEffect(() => {
    (window as typeof window & { __speevyAdminInvestorsHydrated?: boolean }).__speevyAdminInvestorsHydrated = true;
  }, []);

  function closeInvestorSlideout() {
    setSelectedInvestorId(null);
    router.replace('/admin/investors', { scroll: false });
  }

  function toggleInvestorSelection(id: string) {
    setBulkMessage(null);
    setSelectedInvestorIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  }

  function toggleAllInvestors() {
    setBulkMessage(null);
    setSelectedInvestorIds(allInvestorsSelected ? [] : investors.map((investor) => investor.id));
  }

  function toggleSort(field: 'interestedCount' | 'investmentRangeMax') {
    setSort((current) => {
      if (current?.field !== field) return { field, direction: 'desc' };
      if (current.direction === 'desc') return { field, direction: 'asc' };
      return null;
    });
  }

  function handleBulkApprove() {
    if (!canBulkApprove) return;

    startBulkTransition(async () => {
      const result = await bulkApproveInvestors(selectedInvestorIds);
      setBulkMessage(result);

      if (result.status === 'success') {
        setSelectedInvestorIds([]);
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="speevy-bulk-actions" data-bulk-actions hidden={selectedInvestorIds.length === 0}>
        <div className="speevy-bulk-actions-summary">
          <strong data-selected-count>{selectedInvestorIds.length}</strong>
          <span data-selected-label>{selectedInvestorIds.length === 1 ? ' investor selected' : ' investors selected'}</span>
        </div>
        <div className="speevy-bulk-actions-buttons">
          <button
            type="button"
            className="button short w-inline-block"
            data-bulk-approve
            onClick={handleBulkApprove}
            disabled={isBulkPending || !canBulkApprove}
          >
            <div>{isBulkPending ? 'Approving...' : 'Approve Selected'}</div>
          </button>
          <div className="dimsmall" data-bulk-approve-help hidden={canBulkApprove}>
            Bulk approval is available when every selected investor is pending review.
          </div>
          <button
            type="button"
            className="button short secondary w-inline-block"
            data-bulk-clear
            onClick={() => setSelectedInvestorIds([])}
          >
            <div>Clear</div>
          </button>
        </div>
        {bulkMessage ? (
          <div className={`speevy-form-message ${bulkMessage.status}`}>
            {bulkMessage.message}
          </div>
        ) : null}
      </div>

      <div className="contenttable tooltip-table speevy-investors-table">
        <div className="tablerow headerrow">
          <div className="tablecell first">
            <div className="interestchecks-row spacing">
              <button
                type="button"
                className={`checkboxtoggle sm${allInvestorsSelected ? ' checked' : ''}`}
                aria-pressed={allInvestorsSelected}
                aria-label={allInvestorsSelected ? 'Deselect all investors' : 'Select all investors'}
                onClick={toggleAllInvestors}
              >
                {allInvestorsSelected ? <CheckIcon /> : null}
              </button>
            </div>
            <div>Investor</div>
          </div>
          <button
            type="button"
            className="tablecell speevy-sort-cell"
            onClick={() => toggleSort('interestedCount')}
            aria-label="Sort investors by opportunities interested"
            aria-pressed={sort?.field === 'interestedCount'}
            data-sort-field="interestedCount"
          >
            <span className="speevy-table-sort-button">
              <span>Opps. Interested</span>
              <span className="speevy-sort-indicator">
                {sort?.field === 'interestedCount' ? (sort.direction === 'desc' ? '↓' : '↑') : '↕'}
              </span>
            </span>
          </button>
          <div className="tablecell wide">
            <div>Sectors</div>
          </div>
          <button
            type="button"
            className="tablecell speevy-sort-cell"
            onClick={() => toggleSort('investmentRangeMax')}
            aria-label="Sort investors by max check range"
            aria-pressed={sort?.field === 'investmentRangeMax'}
            data-sort-field="investmentRangeMax"
          >
            <span className="speevy-table-sort-button">
              <span>Check Range</span>
              <span className="speevy-sort-indicator">
                {sort?.field === 'investmentRangeMax' ? (sort.direction === 'desc' ? '↓' : '↑') : '↕'}
              </span>
            </span>
          </button>
          <div className="tablecell actions">
            <div>Actions</div>
          </div>
        </div>
        {visibleInvestors.length ? (
          visibleInvestors.map((investor) => {
            const isSelected = selectedInvestorIds.includes(investor.id);

            return (
              <div
                className={`tablerow${isSelected ? ' selected' : ''}`}
                key={investor.id}
                data-investor-row
                data-investor-id={investor.id}
                data-investor-status={investor.status}
                data-interested-count={investor.interestedCount}
                data-investment-range-max={investor.investmentRangeMax ?? -1}
                data-investor-name={investor.fullName || investor.email}
              >
                <div className="tablecell first">
                  <div className="interestchecks-row spacing">
                    <button
                      type="button"
                      className={`checkboxtoggle sm${isSelected ? ' checked' : ''}`}
                      aria-pressed={isSelected}
                      aria-label={`${isSelected ? 'Deselect' : 'Select'} ${investor.fullName || investor.email}`}
                      data-investor-checkbox
                      data-investor-id={investor.id}
                      data-investor-status={investor.status}
                      onClick={() => toggleInvestorSelection(investor.id)}
                    >
                      {isSelected ? <CheckIcon /> : null}
                    </button>
                  </div>
                  <InvestorProfileSquare
                    fullName={investor.fullName}
                    email={investor.email}
                    photoUrl={investor.profilePictureUrl}
                  />
                  <div>
                    <div className="cellname">{investor.fullName || investor.email}</div>
                    <div className="alignrow aligncenter" style={{ gap: '6px', flexWrap: 'wrap' }}>
                      <InvestorStatusBadge investor={investor} />
                      <AccountNdaBadge accountNda={investor.accountNda} />
                      {investor.tags.map((tag) => (
                        <LpTagBadge key={tag.id} tag={tag} />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="tablecell">
                  <InterestedOpportunitiesTooltip investor={investor} />
                </div>
                <div className="tablecell wide">
                  <SectorIconRow sectors={investor.sectors} />
                </div>
                <div className="tablecell">
                  <div>{formatCheckRange(investor.investmentRangeMin, investor.investmentRangeMax)}</div>
                </div>
                <div className="tablecell actions">
                  <div className="alignrow wrap">
                    <button
                      type="button"
                      className="actionlinks w-inline-block"
                      onClick={() => setSelectedInvestorId(investor.id)}
                    >
                      <div>View / Edit</div>
                    </button>
                  </div>
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
            <div className="tablecell wide" />
            <div className="tablecell" />
            <div className="tablecell actions" />
          </div>
        )}
      </div>

      {selectedInvestor ? (
        <InvestorSlideout
          investor={selectedInvestor}
          allTags={allTags}
          onClose={closeInvestorSlideout}
          onSaved={() => {
            setSelectedInvestorId(null);
            router.replace('/admin/investors', { scroll: false });
            router.refresh();
          }}
          onTagsChanged={() => router.refresh()}
        />
      ) : null}
    </>
  );
}
