'use client';

import { useEffect, useState } from 'react';

import { saveOpportunityInterest } from '@/app/opportunities/actions';

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

export function OpportunityInterestCard({
  isGuest = false,
  minimumInvestmentCents,
  opportunityId,
}: {
  isGuest?: boolean;
  minimumInvestmentCents: number;
  opportunityId: string;
}) {
  const [interested, setInterested] = useState(false);
  const [amount, setAmount] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const amountCents = moneyToCents(amount);
  const belowMinimum = interested && amount && amountCents < minimumInvestmentCents;
  const canConfirm = amountCents >= minimumInvestmentCents && !saving;

  useEffect(() => {
    if (!message) return;

    const timeout = window.setTimeout(() => setMessage(''), 3000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  return (
    <div className={`interestwrapper${interested ? ' interested' : ''}`}>
      <button
        type="button"
        className={`interestedcheck${interested ? ' interested' : ''}`}
        onClick={() => {
          setInterested((current) => !current);
          setMessage('');
        }}
      >
        <div>Interested?</div>
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
      {interested ? (
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
                setMessage('');
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
      {interested ? (
        <button
          type="button"
          className="confirmbutton w-inline-block"
          disabled={!canConfirm}
          onClick={async () => {
            setSaving(true);
            setMessage('');

            const result = await saveOpportunityInterest({
              opportunityId,
              amountCents,
            });

            setSaving(false);
            setMessage(
              result.status === 'success'
                ? 'Interest saved.'
                : result.message,
            );
          }}
        >
          <div>{saving ? 'Saving...' : 'Confirm Interest'}</div>
        </button>
      ) : null}
      {message ? (
        <div className="interest-toast" role="status" aria-live="polite">
          {message}
        </div>
      ) : null}
    </div>
  );
}
