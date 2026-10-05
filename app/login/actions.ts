'use server';

import { redirect } from 'next/navigation';

import {
  authRateLimitExceeded,
  type AuthRateLimitKind,
} from '@/lib/auth-rate-limit';
import {
  destinationFor,
  sendLoginCodeFlow,
  verifyLoginCodeFlow,
  type AuthActionState,
  type LoginAuthorization,
  type LoginLpStatus,
} from '@/lib/auth/login-code-flow';
import {
  hasLoopsLoginCodeEnv,
  sendLoginCodeEmail,
} from '@/lib/loops/transactional';
import { getClientIp } from '@/lib/opportunity-rate-limit';
import {
  hasSupabasePublicEnv,
  hasSupabaseServiceRoleEnv,
} from '@/lib/supabase/env';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type { AuthActionState };

// Counts the attempt, then reports whether it must stop. Counter outages
// return null from incrementGateRateLimit and are treated as not exceeded.
// Missing admin credentials also fail open: there is nothing to call
// generateLink or verifyOtp with, and the existing env errors still apply.
async function loginAttemptIsRateLimited(
  kind: AuthRateLimitKind,
  email: string | null,
): Promise<boolean> {
  if (!hasSupabaseServiceRoleEnv()) {
    return false;
  }

  const supabase = createSupabaseAdminClient();
  const clientIp = await getClientIp();
  return authRateLimitExceeded(supabase, { kind, clientIp, email });
}

// LP statuses that may sign in at /login. `invited` LPs have no auth user yet
// and must use their invite link first; `rejected` / `removed` are blocked.
const LOGIN_LP_STATUSES = ['onboarding', 'pending_review', 'approved'] as const;

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
    // includes() is the runtime guard; TypeScript does not narrow lp.status from it.
    return { allowed: true, role: 'lp', lpStatus: lp.status as LoginLpStatus };
  }

  return { allowed: false };
}

const loginCodeDeps = {
  isRateLimited: loginAttemptIsRateLimited,
  hasPublicEnv: hasSupabasePublicEnv,
  hasServiceRoleEnv: hasSupabaseServiceRoleEnv,
  hasLoopsLoginCodeEnv,
  getAuthorization: getLoginAuthorization,
  async issueLoginCode(email: string) {
    const adminSupabase = createSupabaseAdminClient();
    const { data, error } = await adminSupabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    const loginCode = data?.properties?.email_otp;
    if (error || !loginCode) {
      return null;
    }

    return loginCode;
  },
  sendLoginCodeEmail,
  async verifyOtp(email: string, code: string): Promise<AuthActionState> {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'magiclink',
    });

    if (error) {
      return {
        status: 'error',
        email,
        message: 'That code did not work. Request a new one and try again.',
      };
    }

    const authorization = await getLoginAuthorization(email);

    if (!authorization.allowed) {
      await supabase.auth.signOut();

      return {
        status: 'error',
        email,
        message: 'This account is not approved for Speevy login yet.',
      };
    }

    const userId = data?.user?.id;
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
        .ilike('email', email.toLowerCase())
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

    redirect(profile?.role === 'admin' ? '/admin' : destinationFor(authorization));
  },
};

export async function sendLoginCode(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  return sendLoginCodeFlow(formData, loginCodeDeps);
}

export async function verifyLoginCode(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  return verifyLoginCodeFlow(formData, loginCodeDeps);
}
