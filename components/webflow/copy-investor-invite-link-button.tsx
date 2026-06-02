'use client';

import { useEffect, useRef, useState } from 'react';

const copiedStatusDurationMs = 2000;

function getInviteLink() {
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const fallbackOrigin = window.location.origin;

  if (!configuredAppUrl) {
    return new URL('/join', fallbackOrigin).toString();
  }

  try {
    return new URL('/join', configuredAppUrl).toString();
  } catch {
    return new URL('/join', fallbackOrigin).toString();
  }
}

function copyWithFallback(text: string) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';

  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
}

export function CopyInvestorInviteLinkButton() {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    const inviteLink = getInviteLink();

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteLink);
      } else if (!copyWithFallback(inviteLink)) {
        throw new Error('Clipboard copy failed');
      }

      setStatus('copied');
    } catch {
      setStatus('error');
    }

    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }

    resetTimeoutRef.current = setTimeout(() => {
      setStatus('idle');
    }, copiedStatusDurationMs);
  }

  const label = status === 'copied'
    ? 'Copied!'
    : status === 'error'
      ? 'Copy Failed'
      : 'Copy Invite Link';

  return (
    <button
      type="button"
      className="button short w-inline-block"
      onClick={handleCopy}
      aria-live="polite"
    >
      <div>{label}</div>
    </button>
  );
}
