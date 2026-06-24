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
  updateLpNotificationPreferences,
  updateLpSettings,
  type LpNotificationPreferencesActionState,
  type LpSettingsActionState,
} from '@/app/settings/actions';
import { WebflowSectorIcon } from '@/components/webflow/sector-icon';
import type { LpNotificationPreference } from '@/lib/lp/notification-preferences';

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

function NotificationCheckIcon() {
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

type NotificationPreference = LpNotificationPreference;

const NOTIFICATION_PREFERENCE_OPTIONS: Array<{
  value: NotificationPreference;
  label: string;
}> = [
  { value: 'always', label: 'Always notify me' },
  { value: 'sector_match', label: 'Notify me only if it matches my interested sectors' },
  { value: 'never', label: 'Never notify me' },
];

function NotificationPreferenceCard({
  title,
  value,
  onChange,
}: {
  title: string;
  value: NotificationPreference;
  onChange: (value: NotificationPreference) => void;
}) {
  return (
    <div className="pagecard">
      <div className="cardblock">
        <div>
          <div className="sideheading">{title}</div>
        </div>
        <div className="fieldblocks" role="radiogroup" aria-label={title}>
          {NOTIFICATION_PREFERENCE_OPTIONS.map((option) => {
            const checked = value === option.value;

            return (
              <div key={option.value} className="fieldblock">
                <button
                  type="button"
                  className="checkboxrow signup-checkbox"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => onChange(option.value)}
                >
                  <div className="interestchecks-row">
                    {checked ? (
                      <div className="checkboxtoggle checked">
                        <NotificationCheckIcon />
                      </div>
                    ) : (
                      <div className="checkboxtoggle" />
                    )}
                  </div>
                  <div>
                    <div>{option.label}</div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function LpNotificationPreferences({
  initialActiveOpportunityPreference,
  initialNewOpportunityPreference,
}: {
  initialActiveOpportunityPreference: NotificationPreference;
  initialNewOpportunityPreference: NotificationPreference;
}) {
  const [activeOpportunityPreference, setActiveOpportunityPreference] =
    useState<NotificationPreference>(initialActiveOpportunityPreference);
  const [newOpportunityPreference, setNewOpportunityPreference] =
    useState<NotificationPreference>(initialNewOpportunityPreference);
  const [saving, setSaving] = useState(false);
  const [messageState, setMessageState] = useState<LpNotificationPreferencesActionState>({
    status: 'idle',
    message: '',
  });

  async function handleSave() {
    setSaving(true);
    setMessageState({ status: 'idle', message: '' });

    const result = await updateLpNotificationPreferences({
      activeOpportunityPreference,
      newOpportunityPreference,
    });

    setSaving(false);
    setMessageState(result);
  }

  return (
    <div className="notification-preferences-cards">
      <NotificationPreferenceCard
        title='When an Opportunity is made "Active" or "Upcoming"'
        value={activeOpportunityPreference}
        onChange={setActiveOpportunityPreference}
      />
      <NotificationPreferenceCard
        title="When a new Opportunity is added to the platform"
        value={newOpportunityPreference}
        onChange={setNewOpportunityPreference}
      />

      {messageState.message ? (
        <div className={`speevy-form-message ${messageState.status}`}>
          {messageState.message}
        </div>
      ) : null}

      <div className="alignrow alignright">
        <button
          type="button"
          className="button short w-button"
          disabled={saving}
          onClick={() => {
            void handleSave();
          }}
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
}
