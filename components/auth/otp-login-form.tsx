'use client';

import { useActionState, useEffect, useState } from 'react';

import type { AuthActionState } from '@/app/login/actions';
import { sendLoginCode, verifyLoginCode } from '@/app/login/actions';
import {
  sendInviteCode,
  verifyInviteCode,
} from '@/app/invite/[token]/actions';
import { Button } from '@/components/ui/button';

const initialState: AuthActionState = {
  status: 'idle',
  message: '',
};

type OtpLoginFormProps = {
  initialEmail?: string;
  emailLocked?: boolean;
  flow?: 'login' | 'invite';
  submitLabel?: string;
};

export function OtpLoginForm({
  initialEmail = '',
  emailLocked = false,
  flow = 'login',
  submitLabel = 'Send code',
}: OtpLoginFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [codeRequested, setCodeRequested] = useState(false);
  const sendActionForFlow = flow === 'invite' ? sendInviteCode : sendLoginCode;
  const verifyActionForFlow =
    flow === 'invite' ? verifyInviteCode : verifyLoginCode;
  const [sendState, sendAction, sendPending] = useActionState(
    sendActionForFlow,
    initialState,
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyActionForFlow,
    initialState,
  );

  useEffect(() => {
    if (sendState.status === 'success' && sendState.email) {
      setCodeRequested(true);
      setEmail(sendState.email);
    }
  }, [sendState]);

  const activeMessage =
    verifyState.message || sendState.message || 'Use your invited email address.';
  const isError = verifyState.status === 'error' || sendState.status === 'error';

  return (
    <div className="space-y-5">
      <form action={sendAction} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-ink">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            readOnly={emailLocked}
            required
            className="h-12 w-full rounded-xl border border-input bg-white px-4 text-base text-ink shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-copper focus:ring-4 focus:ring-copper/15 read-only:bg-muted"
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="h-12 w-full rounded-xl bg-harbor text-base hover:bg-ink"
          disabled={sendPending}
        >
          {sendPending ? 'Sending...' : submitLabel}
        </Button>
      </form>

      {codeRequested ? (
        <form action={verifyAction} className="space-y-4 rounded-2xl border border-border bg-white/80 p-4 shadow-sm">
          <input type="hidden" name="email" value={email} />
          <div className="space-y-2">
            <label htmlFor="code" className="text-sm font-medium text-ink">
              Verification code
            </label>
            <input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="123456"
              required
              className="h-12 w-full rounded-xl border border-input bg-white px-4 text-center font-mono text-2xl tracking-[0.4em] text-ink shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-copper focus:ring-4 focus:ring-copper/15"
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="h-12 w-full rounded-xl bg-copper text-base text-white hover:bg-copper/90"
            disabled={verifyPending}
          >
            {verifyPending ? 'Verifying...' : 'Continue'}
          </Button>
        </form>
      ) : null}

      <p
        className={`rounded-2xl px-4 py-3 text-sm ${
          isError
            ? 'bg-destructive/10 text-destructive'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        {activeMessage}
      </p>
    </div>
  );
}
