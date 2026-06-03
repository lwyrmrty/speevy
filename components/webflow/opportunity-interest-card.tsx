'use client';

import { useState } from 'react';

import { saveOpportunityInterest } from '@/app/opportunities/actions';
import { useToast } from '@/components/ui/toast';

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

function formatCurrencyInput(value: string) {
  const digits = value.replace(/[^\d]/g, '');

  if (!digits) {
    return '';
  }

  return `$${Number(digits).toLocaleString('en-US')}`;
}

function moneyToCents(value: string) {
  const digits = value.replace(/[^\d]/g, '');
  return digits ? Number(digits) * 100 : 0;
}

function centsToCurrencyInput(value: number | null) {
  if (value === null) {
    return '';
  }

  return formatCurrencyInput(String(value / 100));
}

export function OpportunityInterestCard({
  initialAmountCents = null,
  initialInterested = false,
  isGuest = false,
  minimumInvestmentCents,
  opportunityId,
  variant = 'standard',
}: {
  initialAmountCents?: number | null;
  initialInterested?: boolean;
  isGuest?: boolean;
  minimumInvestmentCents: number;
  opportunityId: string;
  variant?: 'standard' | 'past';
}) {
  const { showToast } = useToast();
  const [interested, setInterested] = useState(initialInterested);
  const [amount, setAmount] = useState(centsToCurrencyInput(initialAmountCents));
  const [email, setEmail] = useState('');
  const [hasStoredInterest, setHasStoredInterest] = useState(initialAmountCents !== null);
  const [saving, setSaving] = useState(false);
  const isPast = variant === 'past';
  const amountCents = moneyToCents(amount);
  const belowMinimum = interested && amount && amountCents < minimumInvestmentCents;
  const canConfirm = (isPast || amountCents >= minimumInvestmentCents) && !saving;

  async function savePastInterest() {
    setSaving(true);

    const result = await saveOpportunityInterest({
      opportunityId,
      amountCents: null,
    });

    setSaving(false);

    if (result.status === 'success') {
      showToast({ status: 'success', text: 'Interest saved.' });
      return;
    }

    setInterested(false);
    showToast({ status: 'error', text: result.message });
  }

  return (
    <div className={`interestwrapper${interested ? ' interested' : ''}`}>
      <button
        type="button"
        className={`interestedcheck${interested ? ' interested' : ''}`}
        disabled={saving}
        onClick={() => {
          const nextInterested = !interested;
          setInterested(nextInterested);

          if (isPast && nextInterested) {
            void savePastInterest();
          }
        }}
      >
        <div>{saving ? 'Saving...' : 'Interested?'}</div>
        <div className="interestchecks-row">
          {interested ? (
            <div className="checkboxtoggle checked">
              <CheckIcon />
            </div>
          ) : (
            <div className="checkboxtoggle" />
          )}
        </div>
      </button>
      {interested && !isPast ? (
        <div className="interestamount-drawer">
          <div className="interestedamount-content">
            {isGuest ? (
              <div className="emailblock">
                <div>Your Email Address</div>
                <input
                  className="textfield w-input"
                  maxLength={256}
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.currentTarget.value)}
                />
              </div>
            ) : null}
            <div>Est. Investment Interest</div>
            <input
              className="textfield w-input"
              maxLength={256}
              name="Amount"
              type="text"
              inputMode="numeric"
              placeholder={`Min. ${formatCurrencyInput(String(minimumInvestmentCents / 100))}`}
              value={amount}
              onChange={(event) => {
                setAmount(formatCurrencyInput(event.currentTarget.value));
              }}
            />
            {belowMinimum ? (
              <div className="dimsmall">Amount must be at least the minimum check size.</div>
            ) : (
              <div className="dimsmall">Non-binding. This helps us better reserve final allocation.</div>
            )}
          </div>
        </div>
      ) : null}
      {interested && !isPast ? (
        <button
          type="button"
          className="confirmbutton w-inline-block"
          disabled={!canConfirm}
          onClick={async () => {
            setSaving(true);

            const result = await saveOpportunityInterest({
              opportunityId,
              amountCents,
            });

            setSaving(false);

            if (result.status === 'success') {
              setHasStoredInterest(true);
              showToast({ status: 'success', text: 'Interest saved.' });
              return;
            }

            showToast({ status: 'error', text: result.message });
          }}
        >
          <div>{saving ? 'Saving...' : hasStoredInterest ? 'Update Interest' : 'Confirm Interest'}</div>
        </button>
      ) : null}
    </div>
  );
}
