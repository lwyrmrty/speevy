'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import {
  hasLoopsLoginCodeEnv,
  sendLoginCodeEmail,
} from '@/lib/loops/transactional';
import {
  hasSupabasePublicEnv,
  hasSupabaseServiceRoleEnv,
} from '@/lib/supabase/env';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type AuthActionState = {
  status: 'idle' | 'success' | 'error';
  message: string;
  email?: string;
};

const emailSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
});

const codeSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code from your email.'),
});

const genericLoginMessage =
  'If this email is approved for Speevy, a login code will arrive shortly.';

// LP statuses that may sign in at /login. `invited` LPs have no auth user yet
// and must use their invite link first; `rejected` / `removed` are blocked.
const LOGIN_LP_STATUSES = ['onboarding', 'pending_review', 'approved'] as const;
type LoginLpStatus = (typeof LOGIN_LP_STATUSES)[number];

type LoginAuthorization =
  | { allowed: true; role: 'admin' }
  | { allowed: true; role: 'lp'; lpStatus: LoginLpStatus }
  | { allowed: false };

function destinationFor(authorization: LoginAuthorization): string {
  if (!authorization.allowed) return '/login';
  if (authorization.role === 'admin') return '/admin';
  return authorization.lpStatus === 'approved' ? '/opportunities' : '/onboarding';
}

async function getLoginAuthorization(email: string): Promise<LoginAuthorization> {
  const normalizedEmail = email.toLowerCase();
  const supabase = createSupabaseAdminClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .ilike('email', normalizedEmail)
    .maybeSingle();

  if (profile?.role === 'admin') {
    return { allowed: true, role: 'admin' };
  }

  const { data: lp } = await supabase
    .from('lps')
    .select('status')
    .ilike('email', normalizedEmail)
    .maybeSingle();

  if (lp && (LOGIN_LP_STATUSES as readonly string[]).includes(lp.status)) {
    return { allowed: true, role: 'lp', lpStatus: lp.status as LoginLpStatus };
  }

  return { allowed: false };
}

export async function sendLoginCode(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = emailSchema.safeParse({
    email: formData.get('email'),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Enter a valid email.',
    };
  }

  if (!hasSupabasePublicEnv()) {
    return {
      status: 'success',
      email: parsed.data.email,
      message:
        'Demo mode: Supabase is not configured yet. Add the emailed code once auth credentials are connected.',
    };
  }

  if (!hasSupabaseServiceRoleEnv()) {
    return {
      status: 'error',
      message:
        'Supabase admin credentials are required before login approval checks can run.',
    };
  }

  if (!hasLoopsLoginCodeEnv()) {
    return {
      status: 'error',
      message:
        'Loops login code email credentials are required before login codes can be sent.',
    };
  }

  const authorization = await getLoginAuthorization(parsed.data.email);

  if (!authorization.allowed) {
    return {
      status: 'success',
      message: genericLoginMessage,
    };
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data, error } = await adminSupabase.auth.admin.generateLink({
    type: 'magiclink',
    email: parsed.data.email,
  });

  const loginCode = data.properties?.email_otp;

  if (error || !loginCode) {
    return {
      status: 'success',
      message: genericLoginMessage,
    };
  }

  try {
    await sendLoginCodeEmail({
      email: parsed.data.email,
      loginCode,
    });
  } catch {
    return {
      status: 'success',
      message: genericLoginMessage,
    };
  }

  return {
    status: 'success',
    email: parsed.data.email,
    message: 'Check your email for a 6-digit Speevy login code.',
  };
}

export async function verifyLoginCode(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = codeSchema.safeParse({
    email: formData.get('email'),
    code: formData.get('code'),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      email: String(formData.get('email') ?? ''),
      message: parsed.error.issues[0]?.message ?? 'Enter the code from your email.',
    };
  }

  if (!hasSupabasePublicEnv()) {
    return {
      status: 'error',
      email: parsed.data.email,
      message: 'Supabase is not configured yet, so the code cannot be verified.',
    };
  }

  if (!hasSupabaseServiceRoleEnv()) {
    return {
      status: 'error',
      email: parsed.data.email,
      message:
        'Supabase admin credentials are required before login approval checks can run.',
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.code,
    type: 'magiclink',
  });

  if (error) {
    return {
      status: 'error',
      email: parsed.data.email,
      message: 'That code did not work. Request a new one and try again.',
    };
  }

  const authorization = await getLoginAuthorization(parsed.data.email);

  if (!authorization.allowed) {
    await supabase.auth.signOut();

    return {
      status: 'error',
      email: parsed.data.email,
      message: 'This account is not approved for Speevy login yet.',
    };
  }

  const userId = data.user?.id;
  if (!userId) {
    redirect(destinationFor(authorization));
  }

  if (authorization.role === 'lp') {
    const adminSupabase = createSupabaseAdminClient();
    const { data: lp } = await adminSupabase
      .from('lps')
      .update({
        profile_id: userId,
        invitation_accepted_at: new Date().toISOString(),
      })
      .ilike('email', parsed.data.email.toLowerCase())
      .is('profile_id', null)
      .select('full_name')
      .maybeSingle();

    if (lp?.full_name) {
      await adminSupabase
        .from('profiles')
        .update({ full_name: lp.full_name })
        .eq('id', userId);
    }
  }

  // A profile promoted to admin out-of-band still routes to /admin even if the
  // lps lookup above matched first.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  redirect(
    profile?.role === 'admin' ? '/admin' : destinationFor(authorization),
  );
}
