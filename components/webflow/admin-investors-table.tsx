'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { updateInvestor, type UpdateInvestorResult } from '@/app/admin/investors/actions';
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

function InvestorSlideout({
  investor,
  onClose,
  onSaved,
}: {
  investor: AdminInvestorRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedSectors, setSelectedSectors] = useState<InvestorSector[]>(investor.sectors);
  const [message, setMessage] = useState<UpdateInvestorResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const minRangeValue = investor.investmentRangeMin === null
    ? ''
    : String(Math.round(investor.investmentRangeMin / 100));
  const maxRangeValue = investor.investmentRangeMax === null
    ? ''
    : String(Math.round(investor.investmentRangeMax / 100));

  function toggleSector(sector: InvestorSector) {
    setSelectedSectors((current) =>
      current.includes(sector)
        ? current.filter((item) => item !== sector)
        : [...current, sector],
    );
  }

  function handleSubmit(formData: FormData) {
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
            <div className="pagetitle small">Investor Details</div>
            <div className="dimsmall">{investor.email}</div>
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
              defaultValue={investor.fullName ?? ''}
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
              defaultValue={investor.entityName ?? ''}
            />
          </div>

          <div className="fieldblock">
            <label htmlFor="Investor-Status" className="fieldlabel">Status</label>
            <select id="Investor-Status" name="status" className="textfield w-input" defaultValue={investor.status}>
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
              <select id="Investor-Min-Range" name="investmentRangeMin" className="textfield w-input" defaultValue={minRangeValue}>
                <option value="">Not set</option>
                {INVESTMENT_RANGE_VALUES.map((value) => (
                  <option key={value} value={value}>{formatInvestmentRange(value)}</option>
                ))}
              </select>
            </div>
            <div className="fieldblock">
              <label htmlFor="Investor-Max-Range" className="fieldlabel">Max Check</label>
              <select id="Investor-Max-Range" name="investmentRangeMax" className="textfield w-input" defaultValue={maxRangeValue}>
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
            <button type="submit" className="button short w-inline-block" disabled={isPending}>
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
  const selectedInvestor = useMemo(
    () => investors.find((investor) => investor.id === selectedInvestorId) ?? null,
    [investors, selectedInvestorId],
  );

  return (
    <>
      <div className="contenttable tooltip-table">
        <div className="tablerow headerrow">
          <div className="tablecell first">
            <div className="interestchecks-row spacing">
              <div className="checkboxtoggle sm" />
            </div>
            <div>Investor</div>
          </div>
          <div className="tablecell">
            <div>Opps. Interested</div>
          </div>
          <div className="tablecell wide">
            <div>Sectors</div>
          </div>
          <div className="tablecell">
            <div>Check Range</div>
          </div>
          <div className="tablecell actions">
            <div>Actions</div>
          </div>
        </div>
        {investors.length ? (
          investors.map((investor) => (
            <div className="tablerow" key={investor.id}>
              <div className="tablecell first">
                <div className="interestchecks-row spacing">
                  <div className="checkboxtoggle sm" />
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
          ))
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
