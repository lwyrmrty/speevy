'use server';

import type { AuthActionState } from '@/app/login/actions';

import { requireTurnstile } from '@/lib/auth/turnstile';

// These actions do not send or verify codes yet, so they do not share the
// login rate-limit buckets. They still avoid throwing when the body never
// became FormData — the same crash seen on POST /login.
function readInviteEmail(formData: FormData | undefined): string {
  if (!formData || typeof formData.get !== 'function') {
    return '';
  }

  try {
    return String(formData.get('email') ?? '').trim();
  } catch {
    return '';
  }
}

export async function sendInviteCode(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const turnstile = await requireTurnstile(formData);
  if (!turnstile.ok) {
    return { status: 'error', message: turnstile.message };
  }

  const email = readInviteEmail(formData);

  return {
    status: 'success',
    email,
    message:
      'Invite token validation is next. Once the token model is live, this will send an onboarding code for invited users.',
  };
}

export async function verifyInviteCode(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const turnstile = await requireTurnstile(formData);
  if (!turnstile.ok) {
    return { status: 'error', message: turnstile.message };
  }

  return {
    status: 'error',
    email: readInviteEmail(formData),
    message:
      'Invite code verification will be enabled after invitation token validation is implemented.',
  };
}
