'use client';

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

export type TurnstileHandle = {
  reset: () => void;
};

type TurnstileFrameMessage = {
  source?: unknown;
  type?: unknown;
  token?: unknown;
};

function isTurnstileFrameMessage(value: unknown): value is TurnstileFrameMessage {
  return Boolean(value) && typeof value === 'object';
}

export const TurnstileWidget = forwardRef<TurnstileHandle>(function TurnstileWidget(
  _props,
  ref,
) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';
  const [token, setToken] = useState('');
  const [frameNonce, setFrameNonce] = useState(0);

  useImperativeHandle(
    ref,
    () => ({
      reset() {
        setToken('');
        setFrameNonce((current) => current + 1);
      },
    }),
    [],
  );

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (!isTurnstileFrameMessage(event.data)) return;
      if (event.data.source !== 'speevy-turnstile') return;
      if (event.data.type === 'token' && typeof event.data.token === 'string') {
        setToken(event.data.token);
        return;
      }
      if (event.data.type === 'error') {
        setToken('');
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (!siteKey) return null;

  return (
    <>
      <input type="hidden" name="cf-turnstile-response" value={token} />
      <iframe
        key={frameNonce}
        title="Verification"
        src={`/turnstile-frame.html?sitekey=${encodeURIComponent(siteKey)}`}
        style={{ width: '100%', height: 80, border: 0, overflow: 'hidden' }}
      />
    </>
  );
});
