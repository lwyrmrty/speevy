'use client';

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';

import type { AuthActionState } from '@/app/login/actions';
import { sendLoginCode, verifyLoginCode } from '@/app/login/actions';
import {
  attachTurnstileToken,
  shouldResetTurnstile,
  TURNSTILE_WAIT_MESSAGE,
  TurnstileWidget,
  type TurnstileHandle,
} from '@/components/auth/turnstile-widget';
import { runAuthAction } from '@/lib/auth/run-auth-action';

const initialState: AuthActionState = {
  status: 'idle',
  message: '',
};

const CODE_LENGTH = 6;

export function WebflowLoginForm() {
  const [email, setEmail] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [digits, setDigits] = useState<string[]>(
    Array.from({ length: CODE_LENGTH }, () => ''),
  );
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const emailTurnstileRef = useRef<TurnstileHandle>(null);
  const codeTurnstileRef = useRef<TurnstileHandle>(null);
  const [, startTransition] = useTransition();

  const [challengeMessage, setChallengeMessage] = useState('');

  const sendLogin = useCallback(async (previous: AuthActionState, formData: FormData) => {
    const result = await runAuthAction(sendLoginCode, previous, formData);
    if (shouldResetTurnstile(result.message)) {
      emailTurnstileRef.current?.reset();
      codeTurnstileRef.current?.reset();
    }
    return result;
  }, []);
  const verifyLogin = useCallback(async (previous: AuthActionState, formData: FormData) => {
    const result = await runAuthAction(verifyLoginCode, previous, formData);
    if (shouldResetTurnstile(result.message)) {
      codeTurnstileRef.current?.reset();
    }
    return result;
  }, []);

  const [sendState, sendAction, sendPending] = useActionState(
    sendLogin,
    initialState,
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyLogin,
    initialState,
  );

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (sendState.status === 'success' && sendState.email) {
      setEmail(sendState.email);
      setStep('code');
    }
  }, [sendState]);

  function handleSendSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (!attachTurnstileToken(formData, emailTurnstileRef.current)) {
      setChallengeMessage(TURNSTILE_WAIT_MESSAGE);
      return;
    }
    setChallengeMessage('');
    sendAction(formData);
  }

  function readEnteredCode(): string {
    const fromState = digits.join('');
    if (fromState.length === CODE_LENGTH) return fromState;

    return inputsRef.current
      .map((input) => (input?.value ?? '').replace(/\D/g, ''))
      .join('')
      .slice(0, CODE_LENGTH);
  }

  function handleVerifySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextCode = readEnteredCode();
    if (nextCode.length < CODE_LENGTH) {
      setChallengeMessage('Enter the 6-digit code from your email.');
      return;
    }

    const formData = new FormData(event.currentTarget);
    formData.set('code', nextCode);
    if (!attachTurnstileToken(formData, codeTurnstileRef.current)) {
      setChallengeMessage(TURNSTILE_WAIT_MESSAGE);
      return;
    }
    setChallengeMessage('');
    verifyAction(formData);
  }

  useEffect(() => {
    if (step === 'code') {
      inputsRef.current[0]?.focus();
    }
  }, [step]);

  const code = digits.join('');

  function setDigitAt(index: number, value: string) {
    setDigits((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  }

  function fillCodeDigits(raw: string) {
    const chars = raw.replace(/\D/g, '').slice(0, CODE_LENGTH).split('');
    setDigits(Array.from({ length: CODE_LENGTH }, (_, i) => chars[i] ?? ''));
    const focusIndex = Math.min(Math.max(chars.length, 1), CODE_LENGTH) - 1;
    queueMicrotask(() => {
      inputsRef.current[focusIndex]?.focus();
    });
  }

  function handleDigitChange(
    index: number,
    event: ChangeEvent<HTMLInputElement> | FormEvent<HTMLInputElement>,
  ) {
    const raw = event.currentTarget.value.replace(/\D/g, '');
    if (!raw) {
      setDigitAt(index, '');
      return;
    }
    if (index === 0 && raw.length > 1) {
      fillCodeDigits(raw);
      return;
    }
    setDigitAt(index, raw[raw.length - 1] ?? '');
    if (index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleDigitKeyDown(
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '');
    if (!pasted) return;
    event.preventDefault();
    fillCodeDigits(pasted);
  }

  function handleResend() {
    if (!email) return;
    const formData = new FormData();
    formData.set('email', email);
    if (!attachTurnstileToken(formData, codeTurnstileRef.current)) {
      setChallengeMessage(TURNSTILE_WAIT_MESSAGE);
      return;
    }
    setChallengeMessage('');
    startTransition(() => {
      sendAction(formData);
    });
  }

  function handleBackToLogin() {
    setStep('email');
    setDigits(Array.from({ length: CODE_LENGTH }, () => ''));
  }

  if (step === 'email') {
    const message = challengeMessage || sendState.message;
    const isError = Boolean(challengeMessage) || sendState.status === 'error';

    return (
      <div className="formblock w-form">
        <form onSubmit={handleSendSubmit} className="loginform">
          <div>
            <div className="loginheader">Login</div>
            <div className="loginsubheader">
              Don&#x27;t have access?{' '}
              <a href="/join" className="inlinelink">
                Request here
              </a>
              .
            </div>
          </div>
          <div className="fieldblock">
            <label htmlFor="Email" className="fieldlabel">
              Email
            </label>
            <input
              className="textfield w-input"
              maxLength={256}
              name="email"
              data-name="Email"
              type="email"
              id="Email"
              defaultValue={email}
              autoComplete="email"
              required
            />
          </div>
          {hydrated ? <TurnstileWidget ref={emailTurnstileRef} /> : null}
          <input
            type="submit"
            className="button w-button"
            value={sendPending ? 'Please wait…' : 'Get Login Code'}
            disabled={!hydrated || sendPending}
          />
        </form>
        {message ? (
          <div
            className="loginsubheader"
            style={isError ? { color: '#b42318' } : undefined}
          >
            {message}
          </div>
        ) : null}
      </div>
    );
  }

  const message = challengeMessage || verifyState.message || sendState.message;
  const isError = Boolean(challengeMessage) || verifyState.status === 'error';

  return (
    <div className="formblock w-form">
      <form onSubmit={handleVerifySubmit} className="loginform">
        <div>
          <div className="loginheader">Check your email</div>
          <div className="loginsubheader">
            We sent a verification code to{' '}
            <span className="fullcolor">{email}</span>.
          </div>
        </div>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="code" value={code} />
        <div className="fieldblock">
          <div className="coderow">
            {digits.map((digit, index) => (
              <input
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                ref={(element) => {
                  inputsRef.current[index] = element;
                }}
                className="codeblock w-input"
                inputMode="numeric"
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                maxLength={index === 0 ? CODE_LENGTH : 1}
                name={`field-${index + 1}`}
                data-name="Field"
                type="text"
                value={digit}
                onChange={(event) => handleDigitChange(index, event)}
                onInput={(event) => handleDigitChange(index, event)}
                onKeyDown={(event) => handleDigitKeyDown(index, event)}
                onPaste={handlePaste}
              />
            ))}
          </div>
        </div>
        <input
          type="submit"
          className="button w-button"
          value={verifyPending ? 'Please wait…' : 'Go to account'}
          disabled={!hydrated || verifyPending}
          style={{ position: 'relative', zIndex: 1 }}
        />
        {hydrated ? <TurnstileWidget ref={codeTurnstileRef} /> : null}
        <div className="loginsubheader">
          Didn&#x27;t receive the email? Check spam or{' '}
          <button
            type="button"
            className="inlinelink"
            onClick={handleResend}
            disabled={sendPending}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            resend code
          </button>
          .
        </div>
        <div className="loginsubheader">
          <button
            type="button"
            className="inlinelink"
            onClick={handleBackToLogin}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            Back to login
          </button>
        </div>
      </form>
      {message ? (
        <div
          className="loginsubheader"
          style={isError ? { color: '#b42318' } : undefined}
        >
          {message}
        </div>
      ) : null}
    </div>
  );
}
