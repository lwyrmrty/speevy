'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  INVESTMENT_RANGE_VALUES,
  INVESTOR_SECTORS,
  formatInvestmentRange,
  type InvestorSector,
} from '@/lib/investor-request';
import {
  updateLpSettings,
  type LpSettingsActionState,
} from '@/app/settings/actions';
import { WebflowSectorIcon } from '@/components/webflow/sector-icon';

type LpSettingsFormProps = {
  email: string;
  initialFullName: string;
  initialSectors: InvestorSector[];
  initialInvestmentRangeMinCents: number | string | null;
  initialInvestmentRangeMaxCents: number | string | null;
};

const initialState: LpSettingsActionState = {
  status: 'idle',
  message: '',
};

function centsToDollarValue(value: number | string | null) {
  if (value === null) return '';

  const cents = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(cents)) return '';

  return String(Math.round(cents / 100));
}

export function LpSettingsForm({
  email,
  initialFullName,
  initialSectors,
  initialInvestmentRangeMinCents,
  initialInvestmentRangeMaxCents,
}: LpSettingsFormProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateLpSettings, initialState);
  const [selectedSectors, setSelectedSectors] = useState<InvestorSector[]>(initialSectors);
  const [fullName, setFullName] = useState(initialFullName);
  const [investmentRangeMin, setInvestmentRangeMin] = useState(
    centsToDollarValue(initialInvestmentRangeMinCents),
  );
  const [investmentRangeMax, setInvestmentRangeMax] = useState(
    centsToDollarValue(initialInvestmentRangeMaxCents),
  );

  useEffect(() => {
    if (state.status === 'success') {
      router.refresh();
    }
  }, [router, state.status]);

  function toggleSector(sector: InvestorSector) {
    setSelectedSectors((current) =>
      current.includes(sector)
        ? current.filter((item) => item !== sector)
        : [...current, sector],
    );
  }

  return (
    <form action={action} className="loginform">
      {selectedSectors.map((sector) => (
        <input key={sector} type="hidden" name="sectors" value={sector} />
      ))}

      <div className="fieldblock">
        <label htmlFor="Settings-Email" className="fieldlabel">Email</label>
        <input
          id="Settings-Email"
          className="textfield w-input"
          type="email"
          value={email}
          readOnly
          disabled
        />
      </div>

      <div className="fieldblock">
        <label htmlFor="Settings-Full-Name" className="fieldlabel">Name</label>
        <input
          id="Settings-Full-Name"
          className="textfield w-input"
          maxLength={256}
          name="fullName"
          type="text"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
        />
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
          <label htmlFor="Settings-Min-Range" className="fieldlabel">Min Capital</label>
          <select
            id="Settings-Min-Range"
            name="investmentRangeMin"
            className="textfield w-input"
            value={investmentRangeMin}
            onChange={(event) => setInvestmentRangeMin(event.target.value)}
          >
            <option value="">Not set</option>
            {INVESTMENT_RANGE_VALUES.map((value) => (
              <option key={value} value={value}>{formatInvestmentRange(value)}</option>
            ))}
          </select>
        </div>
        <div className="fieldblock">
          <label htmlFor="Settings-Max-Range" className="fieldlabel">Max Capital</label>
          <select
            id="Settings-Max-Range"
            name="investmentRangeMax"
            className="textfield w-input"
            value={investmentRangeMax}
            onChange={(event) => setInvestmentRangeMax(event.target.value)}
          >
            <option value="">Not set</option>
            {INVESTMENT_RANGE_VALUES.map((value) => (
              <option key={value} value={value}>{formatInvestmentRange(value)}</option>
            ))}
          </select>
        </div>
      </div>

      {state.message ? (
        <div className={`speevy-form-message ${state.status}`}>
          {state.message}
        </div>
      ) : null}

      <div className="alignrow alignright">
        <button type="submit" className="button short w-button" disabled={pending}>
          {pending ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </form>
  );
}
