'use client';

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react';

import type { AuthActionState } from '@/app/login/actions';
import { sendLoginCode, verifyLoginCode } from '@/app/login/actions';

const initialState: AuthActionState = {
  status: 'idle',
  message: '',
};

const CODE_LENGTH = 6;

export function WebflowLoginForm() {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [digits, setDigits] = useState<string[]>(
    Array.from({ length: CODE_LENGTH }, () => ''),
  );
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const [, startTransition] = useTransition();

  const [sendState, sendAction, sendPending] = useActionState(
    sendLoginCode,
    initialState,
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyLoginCode,
    initialState,
  );

  useEffect(() => {
    if (sendState.status === 'success' && sendState.email) {
      setEmail(sendState.email);
      setStep('code');
    }
  }, [sendState]);

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

  function handleDigitChange(
    index: number,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const raw = event.target.value.replace(/\D/g, '');
    if (!raw) {
      setDigitAt(index, '');
      return;
    }
    const char = raw[raw.length - 1];
    setDigitAt(index, char);
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
    const chars = pasted.slice(0, CODE_LENGTH).split('');
    const next = Array.from({ length: CODE_LENGTH }, (_, i) => chars[i] ?? '');
    setDigits(next);
    const focusIndex = Math.min(chars.length, CODE_LENGTH - 1);
    inputsRef.current[focusIndex]?.focus();
  }

  function handleResend() {
    if (!email) return;
    const formData = new FormData();
    formData.set('email', email);
    startTransition(() => {
      sendAction(formData);
    });
  }

  function handleBackToLogin() {
    setStep('email');
    setDigits(Array.from({ length: CODE_LENGTH }, () => ''));
  }

  if (step === 'email') {
    const message = sendState.message;
    const isError = sendState.status === 'error';

    return (
      <div className="formblock w-form">
        <form action={sendAction} className="loginform">
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
          <input
            type="submit"
            className="button w-button"
            value={sendPending ? 'Please wait…' : 'Get Login Code'}
            disabled={sendPending}
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

  const message = verifyState.message || sendState.message;
  const isError = verifyState.status === 'error';

  return (
    <div className="formblock w-form">
      <form action={verifyAction} className="loginform">
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
                maxLength={1}
                name={`field-${index + 1}`}
                data-name="Field"
                type="text"
                value={digit}
                onChange={(event) => handleDigitChange(index, event)}
                onKeyDown={(event) => handleDigitKeyDown(index, event)}
                onPaste={handlePaste}
                required
              />
            ))}
          </div>
        </div>
        <input
          type="submit"
          className="button w-button"
          value={verifyPending ? 'Please wait…' : 'Go to account'}
          disabled={verifyPending || code.length < CODE_LENGTH}
        />
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
