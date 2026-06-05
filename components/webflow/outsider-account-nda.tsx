'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import {
  getOutsiderAccountNdaSigned,
  type AccountNdaEnvelopeResult,
} from '@/app/account/nda/actions';
import { AccountNdaCeremony } from '@/components/webflow/account-nda-ceremony';

// Hard NDA gate shown to an outsider who unlocked a password-gated opportunity
// but has NOT yet signed Harpoon Ventures' standard account-level NDA. It fully
// replaces the page (no opportunity title, teaser, or body) using the same
// split-panel ceremony layout as the insider onboarding step. The server is the
// authority: it only renders this gate while account_ndas.status !== 'signed',
// so there is no client-side "Later"/dismiss escape hatch.
//
// On the in-iframe completion cue we poll a read-only server action (the
// SignatureAPI webhook is the real source of truth and may lag a few seconds),
// then router.refresh() so the now-signed outsider lands on the opportunity with
// NO admin approval. See docs/nda-gate-design.md §4B.5.

const POLL_INTERVAL_MS = 2_000;
const SLOW_AFTER_ATTEMPTS = 8; // ~16s before we soften the copy
const MAX_ATTEMPTS = 45; // ~90s before we stop auto-polling

function FinalizingPanel({ slow, onContinue }: { slow: boolean; onContinue: () => void }) {
  return (
    <div className="loginsubheader" role="status" aria-live="polite">
      <strong className="fullcolor">Finalizing your signature…</strong>
      <br />
      {slow
        ? "This is taking a little longer than usual. You can keep waiting, or continue once it's ready."
        : 'One moment while we confirm your signed NDA.'}
      {slow ? (
        <div style={{ marginTop: '16px' }}>
          <button type="button" className="button short w-inline-block" onClick={onContinue}>
            <div>Continue to opportunity</div>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function OutsiderNdaGate({
  result,
  opportunityId,
}: {
  result: AccountNdaEnvelopeResult;
  opportunityId: string;
}) {
  const router = useRouter();
  const [finalizing, setFinalizing] = useState(false);
  const [slow, setSlow] = useState(false);
  const startedRef = useRef(false);

  const beginFinalizing = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    setFinalizing(true);
  }, []);

  useEffect(() => {
    if (!finalizing) return undefined;

    let cancelled = false;
    let attempts = 0;

    async function poll() {
      while (!cancelled && attempts < MAX_ATTEMPTS) {
        attempts += 1;
        if (attempts >= SLOW_AFTER_ATTEMPTS && !cancelled) {
          // `slow` is not an effect dependency, so this never restarts the loop.
          setSlow(true);
        }

        try {
          const signed = await getOutsiderAccountNdaSigned(opportunityId);
          if (cancelled) return;
          if (signed) {
            // The server gate now allows the full opportunity render.
            router.refresh();
            return;
          }
        } catch {
          // Transient failure (network/provider) — keep polling.
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [finalizing, opportunityId, router]);

  return (
    <div className="adminpage-wrapper nopadding">
      <div className="admin-wrapper tall">
        <div className="logincontent">
          <div className="loginblock">
            <div className="loginform-wrapper" style={{ maxWidth: '720px' }}>
              <a href="/" className="w-inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/webflow/images/Harpoon-Logo.png"
                  loading="lazy"
                  sizes="(max-width: 931px) 100vw, 931px"
                  srcSet="/webflow/images/Harpoon-Logo-p-500.png 500w, /webflow/images/Harpoon-Logo-p-800.png 800w, /webflow/images/Harpoon-Logo.png 931w"
                  alt="Harpoon Ventures"
                  className="loginlogo"
                />
              </a>
              <div className="formblock w-form">
                <div className="loginform">
                  <div>
                    <div className="loginheader">Review &amp; sign your NDA</div>
                    <div className="loginsubheader">
                      Before viewing this opportunity, please review and sign
                      Harpoon Ventures&#x27; standard NDA. Once signed, you&#x27;ll
                      go straight to the opportunity — no further approval needed.
                    </div>
                  </div>
                  <div className="loginsubheader">
                    Already have access? <a href="/login" className="inlinelink">Log in here</a>.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          className="loginimage-side"
          style={{
            // Inline styles override the Webflow `display: none` this panel gets
            // on small screens so the signing iframe stays usable on mobile,
            // where it stacks below the intro copy.
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#e9f2fb',
            padding: '30px',
          }}
        >
          <div style={{ width: '100%', maxWidth: '620px' }}>
            {finalizing ? (
              <FinalizingPanel slow={slow} onContinue={() => router.refresh()} />
            ) : (
              <AccountNdaCeremony result={result} variant="outsider" onCompleted={beginFinalizing} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
