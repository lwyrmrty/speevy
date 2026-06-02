'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
  bulkApproveInvestors,
  updateInvestor,
  type UpdateInvestorResult,
} from '@/app/admin/investors/actions';
import { WebflowSectorIcon } from '@/components/webflow/sector-icon';
import {
  INVESTMENT_RANGE_VALUES,
  INVESTOR_SECTORS,
  formatInvestmentRange,
  type InvestorSector,
} from '@/lib/investor-request';

export type AdminInvestorRow = {
  id: string;
  email: string;
  fullName: string | null;
  entityName: string | null;
  status: 'invited' | 'onboarding' | 'pending_review' | 'approved' | 'rejected' | 'removed';
  sectors: InvestorSector[];
  investmentRangeMin: number | null;
  investmentRangeMax: number | null;
  joinedAt: string;
  interestedCount: number;
};

const statusLabels: Record<AdminInvestorRow['status'], string> = {
  invited: 'Invited',
  onboarding: 'Onboarding',
  pending_review: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  removed: 'Removed',
};

function statusClass(status: AdminInvestorRow['status']) {
  if (status === 'approved') return 'cellstatus';
  if (status === 'pending_review' || status === 'onboarding') return 'cellstatus potential';
  if (status === 'invited') return 'cellstatus draft';
  return 'cellstatus past';
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

function sectorsMatch(left: InvestorSector[], right: InvestorSector[]) {
  if (left.length !== right.length) return false;

  const rightSet = new Set(right);
  return left.every((sector) => rightSet.has(sector));
}

function InvestorSlideout({
  investor,
  onClose,
  onSaved,
}: {
  investor: AdminInvestorRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState(investor.fullName ?? '');
  const [entityName, setEntityName] = useState(investor.entityName ?? '');
  const [status, setStatus] = useState<AdminInvestorRow['status']>(investor.status);
  const [selectedSectors, setSelectedSectors] = useState<InvestorSector[]>(investor.sectors);
  const [message, setMessage] = useState<UpdateInvestorResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const minRangeValue = investor.investmentRangeMin === null
    ? ''
    : String(Math.round(investor.investmentRangeMin / 100));
  const maxRangeValue = investor.investmentRangeMax === null
    ? ''
    : String(Math.round(investor.investmentRangeMax / 100));
  const [investmentRangeMin, setInvestmentRangeMin] = useState(minRangeValue);
  const [investmentRangeMax, setInvestmentRangeMax] = useState(maxRangeValue);
  const hasChanges = fullName.trim() !== (investor.fullName ?? '').trim()
    || entityName.trim() !== (investor.entityName ?? '').trim()
    || status !== investor.status
    || investmentRangeMin !== minRangeValue
    || investmentRangeMax !== maxRangeValue
    || !sectorsMatch(selectedSectors, investor.sectors);

  function toggleSector(sector: InvestorSector) {
    setMessage(null);
    setSelectedSectors((current) =>
      current.includes(sector)
        ? current.filter((item) => item !== sector)
        : [...current, sector],
    );
  }

  function handleSubmit(formData: FormData) {
    if (!hasChanges) return;

    selectedSectors.forEach((sector) => formData.append('sectors', sector));
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
            <div className="fieldlabel">Sectors Interested</div>
            <div className="pillswrapper">
              {INVESTOR_SECTORS.map((sector) => {
                const selected = selectedSectors.includes(sector);

                return (
                  <button
                    key={sector}
                    type="button"
                    className={`selectpill w-inline-block${selected ? ' selected' : ''}`}
                    onClick={() => toggleSector(sector)}
                  >
                    <div className="alignrow aligncenter">
                      <div className={`selectlink-icon${selected ? ' selected' : ''}`}>
                        <WebflowSectorIcon sector={sector} />
                      </div>
                      <div>{sector}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="fieldrow">
            <div className="fieldblock">
              <label htmlFor="Investor-Min-Range" className="fieldlabel">Min Check</label>
              <select
                id="Investor-Min-Range"
                name="investmentRangeMin"
                className="textfield w-input"
                value={investmentRangeMin}
                onChange={(event) => {
                  setMessage(null);
                  setInvestmentRangeMin(event.target.value);
                }}
              >
                <option value="">Not set</option>
                {INVESTMENT_RANGE_VALUES.map((value) => (
                  <option key={value} value={value}>{formatInvestmentRange(value)}</option>
                ))}
              </select>
            </div>
            <div className="fieldblock">
              <label htmlFor="Investor-Max-Range" className="fieldlabel">Max Check</label>
              <select
                id="Investor-Max-Range"
                name="investmentRangeMax"
                className="textfield w-input"
                value={investmentRangeMax}
                onChange={(event) => {
                  setMessage(null);
                  setInvestmentRangeMax(event.target.value);
                }}
              >
                <option value="">Not set</option>
                {INVESTMENT_RANGE_VALUES.map((value) => (
                  <option key={value} value={value}>{formatInvestmentRange(value)}</option>
                ))}
              </select>
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

export function AdminInvestorsTable({ investors }: { investors: AdminInvestorRow[] }) {
  const router = useRouter();
  const [selectedInvestorId, setSelectedInvestorId] = useState<string | null>(null);
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

      <div className="contenttable tooltip-table">
        <div className="tablerow headerrow">
          <div className="tablecell first">
            <div className="interestchecks-row spacing">
              <button
                type="button"
                className={`checkboxtoggle sm${allInvestorsSelected ? ' checked' : ''}`}
                aria-pressed={allInvestorsSelected}
                aria-label={allInvestorsSelected ? 'Deselect all investors' : 'Select all investors'}
                onClick={toggleAllInvestors}
              />
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
                    />
                  </div>
                  <div>
                    <div className="cellname">{investor.fullName || investor.email}</div>
                    <div className={statusClass(investor.status)}>{statusLabels[investor.status]}</div>
                  </div>
                </div>
                <div className="tablecell">
                  <div>
                    {investor.interestedCount} <span className="dimish">
                      {investor.interestedCount === 1 ? 'opportunity' : 'opportunities'}
                    </span>
                  </div>
                </div>
                <div className="tablecell wide">
                  <SectorIconRow sectors={investor.sectors} />
                </div>
                <div className="tablecell">
                  <div>{formatCheckRange(investor.investmentRangeMin, investor.investmentRangeMax)}</div>
                </div>
                <div className="tablecell actions">
                  <button
                    type="button"
                    className="actionlinks w-inline-block"
                    onClick={() => setSelectedInvestorId(investor.id)}
                  >
                    <div>View / Edit</div>
                  </button>
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
          onClose={() => setSelectedInvestorId(null)}
          onSaved={() => {
            setSelectedInvestorId(null);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
