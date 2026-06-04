'use client';

import { useEffect, useState } from 'react';

import type { AccountNdaEnvelopeResult } from '@/app/account/nda/actions';

// Shared embedded account-NDA signing ceremony, reused by the onboarding page
// (insiders, token-resolved) and the outsider surfacing on a gated opportunity.
// The parent resolves the AccountNdaEnvelopeResult server-side and passes it in.
//
// The in-iframe completion message is a UX cue ONLY — it flips the view to a
// "thanks" state immediately so the signer isn't left staring at a stale frame.
// The SignatureAPI webhook remains the source of truth for the recorded status
// (badge, stored PDF, email). See docs/nda-gate-design.md §4B.5.

type Variant = 'onboarding' | 'outsider';

// Best-effort detection of the ceremony "completed" postMessage. We do not know
// the exact provider origin, and this only drives a cosmetic state change, so we
// match defensively on common shapes/keywords rather than trusting any field.
function looksLikeCompletion(data: unknown): boolean {
  if (typeof data === 'string') {
    return /complete|signed|finish/i.test(data);
  }
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const candidate = [record.type, record.event, record.name, record.status]
      .filter((value): value is string => typeof value === 'string')
      .join(' ');
    return /complete|signed|finish/i.test(candidate);
  }
  return false;
}

function buildEmbeddedUrl(ceremonyUrl: string) {
  // The create response returns a hosted ceremony URL that already carries query
  // params, so always append with `&`.
  const separator = ceremonyUrl.includes('?') ? '&' : '?';
  return `${ceremonyUrl}${separator}embedded=true&event_delivery=message`;
}

function ThanksState({ variant }: { variant: Variant }) {
  return (
    <div className="loginsubheader" role="status">
      <strong className="fullcolor">Thank you — your NDA is signed.</strong>
      <br />
      {variant === 'onboarding'
        ? "We'll review your information and be in touch after review."
        : 'A copy will be emailed to you shortly.'}
    </div>
  );
}

export function AccountNdaCeremony({
  result,
  variant,
}: {
  result: AccountNdaEnvelopeResult;
  variant: Variant;
}) {
  const [signed, setSigned] = useState(result.status === 'already_signed');
  const ceremonyUrl = result.status === 'success' ? buildEmbeddedUrl(result.ceremonyUrl) : null;

  useEffect(() => {
    if (!ceremonyUrl) return undefined;

    function handleMessage(event: MessageEvent) {
      if (looksLikeCompletion(event.data)) {
        setSigned(true);
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [ceremonyUrl]);

  if (signed) {
    return <ThanksState variant={variant} />;
  }

  if (result.status === 'skipped') {
    // No account-default template configured — never an error for the LP.
    return (
      <div className="loginsubheader" role="status">
        {variant === 'onboarding'
          ? "You're all set for now. We'll follow up with any documents you need to review."
          : 'No additional documents are required right now.'}
      </div>
    );
  }

  if (result.status === 'error') {
    return (
      <div className="loginsubheader" role="status">
        We couldn&#x27;t load the NDA right now. You can revisit this link later, or
        we&#x27;ll follow up directly.
      </div>
    );
  }

  // status === 'success'
  return (
    <div className="account-nda-ceremony">
      <iframe
        title="Sign your NDA"
        src={ceremonyUrl ?? undefined}
        className="account-nda-ceremony-frame"
        style={{
          width: '100%',
          minHeight: '640px',
          border: '0',
          borderRadius: '12px',
        }}
        allow="camera; microphone; fullscreen"
      />
    </div>
  );
}
