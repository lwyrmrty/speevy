'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { getInvestorNdaOnboardingUrl } from '@/app/admin/investors/actions';

const copiedStatusDurationMs = 2000;

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

export function CopyInvestorNdaLinkButton({
  lpId,
  className = 'actionlinks w-inline-block',
}: {
  lpId: string;
  className?: string;
}) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  function scheduleReset() {
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }

    resetTimeoutRef.current = setTimeout(() => {
      setStatus('idle');
      setErrorMessage(null);
    }, copiedStatusDurationMs);
  }

  function handleCopy() {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await getInvestorNdaOnboardingUrl({ lpId });

      if (result.status === 'error') {
        setStatus('error');
        setErrorMessage(result.message);
        scheduleReset();
        return;
      }

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(result.url);
        } else if (!copyWithFallback(result.url)) {
          throw new Error('Clipboard copy failed');
        }

        setStatus('copied');
      } catch {
        setStatus('error');
        setErrorMessage('Could not copy the link. Please try again.');
      }

      scheduleReset();
    });
  }

  const label = isPending
    ? 'Copying...'
    : status === 'copied'
      ? 'Copied!'
      : status === 'error'
        ? 'Copy Failed'
        : 'Copy NDA Link';

  return (
    <button
      type="button"
      className={className}
      onClick={handleCopy}
      disabled={isPending}
      aria-live="polite"
      title={errorMessage ?? undefined}
    >
      <div>{label}</div>
    </button>
  );
}
