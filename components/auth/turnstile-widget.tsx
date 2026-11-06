'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import { TURNSTILE_FIELD, TURNSTILE_USER_MESSAGE } from '@/lib/auth/turnstile';

export type TurnstileHandle = {
  reset: () => void;
  getToken: () => string;
};

type TurnstileFrameMessage = {
  source?: unknown;
  type?: unknown;
  token?: unknown;
};

type TurnstileFrameWindow = Window & {
  __speevyTurnstileToken?: unknown;
};

function isTurnstileFrameMessage(value: unknown): value is TurnstileFrameMessage {
  return Boolean(value) && typeof value === 'object';
}

function readFrameToken(frame: HTMLIFrameElement | null): string {
  try {
    // Same-origin frame page sets this on window from public/turnstile-frame.html.
    const frameWindow = frame?.contentWindow as TurnstileFrameWindow | null | undefined;
    const value = frameWindow?.__speevyTurnstileToken;
    return typeof value === 'string' ? value.trim() : '';
  } catch {
    return '';
  }
}

export const TURNSTILE_WAIT_MESSAGE =
  'Wait for the verification check to finish, then try again.';

export function attachTurnstileToken(
  formData: FormData,
  widget: TurnstileHandle | null,
): boolean {
  const token = widget?.getToken().trim() ?? '';
  if (!token) return false;
  formData.set(TURNSTILE_FIELD, token);
  return true;
}

export function shouldResetTurnstile(message: string): boolean {
  return message !== TURNSTILE_USER_MESSAGE;
}

export const TurnstileWidget = forwardRef<TurnstileHandle>(function TurnstileWidget(
  _props,
  ref,
) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';
  const [token, setToken] = useState('');
  const [frameNonce, setFrameNonce] = useState(0);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tokenRef = useRef('');

  function storeToken(next: string) {
    tokenRef.current = next;
    setToken(next);
    if (inputRef.current) {
      inputRef.current.value = next;
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      reset() {
        storeToken('');
        setFrameNonce((current) => current + 1);
      },
      getToken() {
        return (
          tokenRef.current.trim() ||
          readFrameToken(frameRef.current) ||
          inputRef.current?.value.trim() ||
          ''
        );
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
        storeToken(event.data.token);
        const source = event.source;
        // MessageEventSource includes MessagePort/ServiceWorker, which do not
        // accept a target origin string. The iframe is a Window.
        const frameWindow = source as Window | null;
        if (frameWindow && typeof frameWindow.postMessage === 'function') {
          frameWindow.postMessage(
            { source: 'speevy-turnstile', type: 'ack' },
            event.origin,
          );
        }
        return;
      }
      if (event.data.type === 'error') {
        storeToken('');
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const timer = window.setInterval(() => {
      const next = readFrameToken(frame);
      if (next && next !== tokenRef.current) {
        storeToken(next);
      }
    }, 200);

    return () => window.clearInterval(timer);
  }, [frameNonce]);

  if (!siteKey) return null;

  return (
    <>
      <input
        ref={inputRef}
        type="hidden"
        name={TURNSTILE_FIELD}
        defaultValue={token}
      />
      <iframe
        ref={frameRef}
        key={frameNonce}
        title="Verification"
        src={`/turnstile-frame.html?sitekey=${encodeURIComponent(siteKey)}`}
        style={{ width: '100%', height: 80, border: 0, overflow: 'hidden' }}
      />
    </>
  );
});
