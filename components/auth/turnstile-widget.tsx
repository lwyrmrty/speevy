'use client';

import { forwardRef, memo, useEffect, useImperativeHandle, useRef } from 'react';

// Explicit mode only. Loading api.js with class `cf-turnstile` also auto-renders,
// and a second turnstile.render() call crashes the login page on iOS Safari.
export const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type TurnstileRenderOptions = {
  sitekey: string;
  'error-callback'?: () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
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
    const fail = () => {
      scriptPromise = null;
      reject(new Error('Turnstile failed to load'));
    };

    const succeed = () => {
      if (window.turnstile) {
        resolve();
        return;
      }
      fail();
    };

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${TURNSTILE_SCRIPT_SRC}"]`,
    );

    if (existing) {
      existing.addEventListener('load', succeed, { once: true });
      existing.addEventListener('error', fail, { once: true });
      if (window.turnstile) {
        succeed();
      }
      return;
    }

    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.addEventListener('load', succeed, { once: true });
    script.addEventListener('error', fail, { once: true });
    document.head.appendChild(script);
  });

  return scriptPromise;
}

function resetWidget(widgetId: string | null) {
  try {
    if (!window.turnstile || !widgetId) return;
    window.turnstile.reset(widgetId);
  } catch {
    // Widget may already be gone.
  }
}

function removeWidget(widgetId: string | null) {
  try {
    if (!widgetId) return;
    window.turnstile?.remove(widgetId);
  } catch {
    // Widget may already be gone.
  }
}

export const TurnstileWidget = memo(
  forwardRef<TurnstileHandle>(function TurnstileWidget(_props, ref) {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';
    const hostRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        reset() {
          resetWidget(widgetIdRef.current);
        },
      }),
      [],
    );

    useEffect(() => {
      const host = hostRef.current;
      if (!siteKey || !host) return;

      const mount = document.createElement('div');
      host.appendChild(mount);

      let cancelled = false;

      loadTurnstileScript()
        .then(() => {
          if (cancelled || !mount.isConnected || !window.turnstile) return;
          try {
            widgetIdRef.current = window.turnstile.render(mount, {
              sitekey: siteKey,
              'error-callback': () => {
                // Keep the page alive. The server action fails closed without a token.
              },
            });
          } catch {
            // Fail closed without crashing login.
          }
        })
        .catch(() => {
          // No token is posted. The server action fails closed.
        });

      return () => {
        cancelled = true;
        const widgetId = widgetIdRef.current;
        widgetIdRef.current = null;
        removeWidget(widgetId);
        mount.remove();
      };
    }, [siteKey]);

    if (!siteKey) return null;

    return <div ref={hostRef} />;
  }),
);
