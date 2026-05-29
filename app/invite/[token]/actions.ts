'use server';

import type { AuthActionState } from '@/app/login/actions';

export async function sendInviteCode(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get('email') ?? '').trim();

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
  return {
    status: 'error',
    email: String(formData.get('email') ?? ''),
    message:
      'Invite code verification will be enabled after invitation token validation is implemented.',
  };
}
