'use client';

import { useRouter } from 'next/navigation';
import {
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';

import {
  requestOpportunityAccess,
  verifyOpportunityAccess,
} from '@/app/opportunities/actions';
import { WebflowPasswordField } from '@/components/webflow/password-field';

const CODE_LENGTH = 6;

export function OpportunityPasswordGate({
  slug,
  title,
  teaser,
}: {
  slug: string;
  title: string;
  teaser: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState<string[]>(
    Array.from({ length: CODE_LENGTH }, () => ''),
  );
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const code = digits.join('');

  function resetCode() {
    setDigits(Array.from({ length: CODE_LENGTH }, () => ''));
  }

  function setDigitAt(index: number, value: string) {
    setDigits((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  }

  function handleDigitChange(index: number, event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value.replace(/\D/g, '');
    if (!raw) {
      setDigitAt(index, '');
      return;
    }
    setDigitAt(index, raw[raw.length - 1]);
    if (index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleDigitKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '');
    if (!pasted) return;
    event.preventDefault();
    const chars = pasted.slice(0, CODE_LENGTH).split('');
    setDigits(Array.from({ length: CODE_LENGTH }, (_, i) => chars[i] ?? ''));
    inputsRef.current[Math.min(chars.length, CODE_LENGTH - 1)]?.focus();
  }

  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setNotice('');

    const result = await requestOpportunityAccess({
      slug,
      password,
      email,
      firstName,
      lastName,
    });

    if (result.status === 'granted') {
      router.refresh();
      return;
    }

    setSubmitting(false);

    if (result.status === 'code_sent') {
      resetCode();
      setStep('code');
      setNotice('We emailed you a 6-digit verification code.');
      return;
    }

    setError(result.message);
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setNotice('');

    const result = await verifyOpportunityAccess({
      slug,
      password,
      email,
      firstName,
      lastName,
      code,
    });

    if (result.status === 'granted') {
      router.refresh();
      return;
    }

    setSubmitting(false);
    resetCode();
    inputsRef.current[0]?.focus();
    setError(result.message);
  }

  async function handleResend() {
    setSubmitting(true);
    setError('');
    setNotice('');

    const result = await requestOpportunityAccess({
      slug,
      password,
      email,
      firstName,
      lastName,
    });

    setSubmitting(false);

    if (result.status === 'granted') {
      router.refresh();
      return;
    }

    if (result.status === 'code_sent') {
      resetCode();
      setNotice('We sent a new code to your email.');
      return;
    }

    setError(result.message);
  }

  function handleBackToForm() {
    setStep('form');
    resetCode();
    setError('');
    setNotice('');
  }

  const linkButtonStyle = {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    font: 'inherit',
  } as const;

  return (
    <div className="adminpage-wrapper nopadding">
      <div className="admin-wrapper tall">
        <div className="logincontent">
          <div className="loginblock">
            <div className="loginform-wrapper">
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
                {step === 'form' ? (
                  <form className="loginform" onSubmit={handleRequest}>
                    <div>
                      <div className="loginheader">{title}</div>
                      <div className="loginsubheader">
                        {teaser
                          ? teaser
                          : 'This opportunity is password protected.'}{' '}
                        Enter your name, the password you were given, and your
                        email. We&#x27;ll email you a verification code to view it.
                      </div>
                    </div>
                    <div className="fieldblock">
                      <label htmlFor="opportunity-first-name" className="fieldlabel">
                        First Name
                      </label>
                      <input
                        className="textfield w-input"
                        maxLength={100}
                        name="firstName"
                        id="opportunity-first-name"
                        type="text"
                        autoComplete="given-name"
                        value={firstName}
                        onChange={(event) => setFirstName(event.currentTarget.value)}
                        required
                      />
                    </div>
                    <div className="fieldblock">
                      <label htmlFor="opportunity-last-name" className="fieldlabel">
                        Last Name
                      </label>
                      <input
                        className="textfield w-input"
                        maxLength={100}
                        name="lastName"
                        id="opportunity-last-name"
                        type="text"
                        autoComplete="family-name"
                        value={lastName}
                        onChange={(event) => setLastName(event.currentTarget.value)}
                        required
                      />
                    </div>
                    <div className="fieldblock">
                      <label htmlFor="opportunity-password" className="fieldlabel">
                        Password
                      </label>
                      <WebflowPasswordField
                        className="textfield w-input"
                        name="password"
                        id="opportunity-password"
                        autoComplete="off"
                        value={password}
                        onChange={(event) => setPassword(event.currentTarget.value)}
                        required
                      />
                    </div>
                    <div className="fieldblock">
                      <label htmlFor="opportunity-email" className="fieldlabel">
                        Email
                      </label>
                      <input
                        className="textfield w-input"
                        maxLength={256}
                        name="email"
                        id="opportunity-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.currentTarget.value)}
                        required
                      />
                    </div>
                    <input
                      type="submit"
                      className="button w-button"
                      value={submitting ? 'Please wait…' : 'Continue'}
                      disabled={submitting}
                    />
                  </form>
                ) : (
                  <form className="loginform" onSubmit={handleVerify}>
                    <div>
                      <div className="loginheader">Check your email</div>
                      <div className="loginsubheader">
                        We sent a 6-digit verification code to{' '}
                        <span className="fullcolor">{email}</span>. Enter it below
                        to view this opportunity.
                      </div>
                    </div>
                    <div className="fieldblock">
                      <div className="coderow">
                        {digits.map((digit, index) => (
                          <input
                            key={index}
                            ref={(element) => {
                              inputsRef.current[index] = element;
                            }}
                            className="codeblock w-input"
                            inputMode="numeric"
                            autoComplete={index === 0 ? 'one-time-code' : 'off'}
                            maxLength={1}
                            name={`code-${index + 1}`}
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
                      value={submitting ? 'Please wait…' : 'View Opportunity'}
                      disabled={submitting || code.length < CODE_LENGTH}
                    />
                    <div className="loginsubheader">
                      Didn&#x27;t receive the email? Check spam or{' '}
                      <button
                        type="button"
                        className="inlinelink"
                        onClick={handleResend}
                        disabled={submitting}
                        style={linkButtonStyle}
                      >
                        resend code
                      </button>
                      .
                    </div>
                    <div className="loginsubheader">
                      <button
                        type="button"
                        className="inlinelink"
                        onClick={handleBackToForm}
                        style={linkButtonStyle}
                      >
                        Use a different email
                      </button>
                    </div>
                  </form>
                )}
                {error ? (
                  <div className="loginsubheader" style={{ color: '#b42318' }}>
                    {error}
                  </div>
                ) : null}
                {!error && notice ? (
                  <div className="loginsubheader">{notice}</div>
                ) : null}
                <div className="loginsubheader">
                  Already an investor with us?{' '}
                  <a href="/login" className="inlinelink">
                    Sign in
                  </a>
                  .
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="loginimage-side">
          <div className="loginimage">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/webflow/images/ivan-bandura-5cwigXmGWTo-unsplash.webp"
              loading="lazy"
              sizes="(max-width: 2246px) 100vw, 2246px"
              srcSet="/webflow/images/ivan-bandura-5cwigXmGWTo-unsplash-p-500.webp 500w, /webflow/images/ivan-bandura-5cwigXmGWTo-unsplash-p-800.webp 800w, /webflow/images/ivan-bandura-5cwigXmGWTo-unsplash-p-1080.webp 1080w, /webflow/images/ivan-bandura-5cwigXmGWTo-unsplash-p-1600.webp 1600w, /webflow/images/ivan-bandura-5cwigXmGWTo-unsplash-p-2000.webp 2000w, /webflow/images/ivan-bandura-5cwigXmGWTo-unsplash.webp 2246w"
              alt=""
              className="full-image"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
