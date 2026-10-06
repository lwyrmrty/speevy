'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

type TurnstileApi = {
  render: (container: HTMLElement, options: { sitekey: string }) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type TurnstileHandle = {
  reset: () => void;
};

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined' || window.turnstile) {
    return Promise.resolve();
  }

  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${TURNSTILE_SCRIPT_SRC}"]`,
    );
    const script = existing ?? document.createElement('script');

    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener(
      'error',
      () => {
        scriptPromise = null;
        reject(new Error('Turnstile failed to load'));
      },
      { once: true },
    );

    if (!existing) {
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  return scriptPromise;
}

export const TurnstileWidget = forwardRef<TurnstileHandle>(function TurnstileWidget(_props, ref) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useImperativeHandle(ref, () => ({
    reset() {
      if (!window.turnstile) return;
      const widgetId = widgetIdRef.current;
      if (widgetId) {
        window.turnstile.reset(widgetId);
        return;
      }
      window.turnstile.reset();
    },
  }), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!siteKey || !container) return;

    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !container.isConnected || !window.turnstile) return;
        if (container.querySelector('iframe') || widgetIdRef.current) return;
        widgetIdRef.current = window.turnstile.render(container, { sitekey: siteKey });
      })
      .catch(() => {
        // No token is posted. The server action fails closed.
      });

    return () => {
      cancelled = true;
      const widgetId = widgetIdRef.current;
      widgetIdRef.current = null;
      if (widgetId) {
        window.turnstile?.remove(widgetId);
      }
    };
  }, [siteKey]);

  if (!siteKey) return null;

  return <div ref={containerRef} className="cf-turnstile" data-sitekey={siteKey} />;
});
