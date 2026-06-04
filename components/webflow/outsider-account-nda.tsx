'use client';

import { useEffect, useState } from 'react';

import {
  getAccountNdaCeremonyForOutsider,
  type AccountNdaEnvelopeResult,
} from '@/app/account/nda/actions';
import { AccountNdaCeremony } from '@/components/webflow/account-nda-ceremony';

// Surfaces the SAME account-level NDA to an outsider who has unlocked a
// password-gated opportunity. It is informational (no new automatic gate): we
// only prompt while it is not yet signed, and the prompt is dismissible.
//
// The ceremony envelope is created lazily — only when the outsider opens the
// modal — so a casual page view does not mint an envelope. The lp_id is resolved
// server-side from the opportunity access cookie. See docs/nda-gate-design.md
// §4B.5.

export function OutsiderAccountNda({ opportunityId }: { opportunityId: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AccountNdaEnvelopeResult | null>(null);

  // Suppress the prompt for this browser session once the account NDA is known
  // to be signed already (keyed by opportunity is fine — the NDA is per-LP).
  const sessionKey = 'speevy_account_nda_signed';

  useEffect(() => {
    if (typeof window !== 'undefined' && window.sessionStorage.getItem(sessionKey) === '1') {
      setDismissed(true);
    }
  }, []);

  async function handleOpen() {
    setOpen(true);
    if (result || loading) return;

    setLoading(true);
    const next = await getAccountNdaCeremonyForOutsider(opportunityId);
    setResult(next);
    setLoading(false);

    if (next.status === 'already_signed') {
      window.sessionStorage.setItem(sessionKey, '1');
      setOpen(false);
      setDismissed(true);
    } else if (next.status === 'skipped') {
      // Nothing to sign; quietly stand down.
      setOpen(false);
      setDismissed(true);
    }
  }

  if (dismissed) {
    return null;
  }

  return (
    <>
      <div className="speevy-form-message" role="note" style={{ marginBottom: '12px' }}>
        <div className="alignrow aligncenter" style={{ gap: '10px', flexWrap: 'wrap' }}>
          <div>
            Please review and sign Harpoon Ventures&#x27; standard NDA to complete
            your access.
          </div>
          <div className="alignrow aligncenter" style={{ gap: '8px' }}>
            <button type="button" className="button short w-inline-block" onClick={handleOpen}>
              <div>Review &amp; Sign NDA</div>
            </button>
            <button
              type="button"
              className="button short secondary w-inline-block"
              onClick={() => setDismissed(true)}
            >
              <div>Later</div>
            </button>
          </div>
        </div>
      </div>

      {open ? (
        <div
          className="speevy-slideout-layer document-viewer-layer"
          role="dialog"
          aria-modal="true"
          aria-label="Sign your NDA"
        >
          <button
            type="button"
            className="speevy-slideout-backdrop"
            aria-label="Close NDA"
            onClick={() => setOpen(false)}
          />
          <div className="speevy-slideout-panel document-viewer-panel">
            <div className="speevy-slideout-header">
              <div>
                <div className="pagetitle small">Standard NDA</div>
                <div className="dimsmall">Review and sign to complete your access.</div>
              </div>
              <button
                type="button"
                className="speevy-slideout-close"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                <div>×</div>
              </button>
            </div>
            <div className="document-viewer-body" style={{ padding: '16px' }}>
              {loading || !result ? (
                <div className="loginsubheader">Loading your NDA…</div>
              ) : (
                <AccountNdaCeremony result={result} variant="outsider" />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
