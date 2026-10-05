import { z } from 'zod';

import { AUTH_RATE_LIMIT_MESSAGE, type AuthRateLimitKind } from '@/lib/auth-rate-limit';

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

const invalidEmailMessage = 'Enter a valid email address.';
const invalidCodeMessage = 'Enter the 6-digit code from your email.';

export type LoginLpStatus = 'onboarding' | 'pending_review' | 'approved';

export type LoginAuthorization =
  | { allowed: true; role: 'admin' }
  | { allowed: true; role: 'lp'; lpStatus: LoginLpStatus }
  | { allowed: false };

export type LoginCodeFlowDeps = {
  isRateLimited: (kind: AuthRateLimitKind, email: string | null) => Promise<boolean>;
  hasPublicEnv: () => boolean;
  hasServiceRoleEnv: () => boolean;
  hasLoopsLoginCodeEnv: () => boolean;
  getAuthorization: (email: string) => Promise<LoginAuthorization>;
  // Returns the emailed code, or null when issuance failed. Callers must not
  // log the code.
  issueLoginCode: (email: string) => Promise<string | null>;
  sendLoginCodeEmail: (input: { email: string; loginCode: string }) => Promise<void>;
  // Runs only after the verify rate limit and input checks pass. Owns the
  // Supabase session client for verifyOtp, sign-out, and the post-login redirect.
  verifyOtp: (email: string, code: string) => Promise<AuthActionState>;
};

// Reads posted fields without letting a missing or truncated body throw.
// Next.js can still reject `Unexpected end of form` before the action runs;
// this only covers throws the action itself can see (`formData` missing, or
// `formData.get` throwing).
function readFormFields(
  formData: FormData | undefined,
  fields: readonly string[],
): Record<string, string> | null {
  if (!formData || typeof formData.get !== 'function') {
    return null;
  }

  try {
    const values: Record<string, string> = {};
    for (const field of fields) {
      const value = formData.get(field);
      values[field] = typeof value === 'string' ? value : '';
    }
    return values;
  } catch {
    return null;
  }
}

export function destinationFor(authorization: LoginAuthorization): string {
  if (!authorization.allowed) return '/login';
  if (authorization.role === 'admin') return '/admin';
  return authorization.lpStatus === 'approved' ? '/opportunities' : '/onboarding';
}

export async function sendLoginCodeFlow(
  formData: FormData | undefined,
  deps: LoginCodeFlowDeps,
): Promise<AuthActionState> {
  const fields = readFormFields(formData, ['email']);
  const parsed = emailSchema.safeParse({
    email: fields?.email,
  });

  if (await deps.isRateLimited('send', parsed.success ? parsed.data.email : null)) {
    return {
      status: 'error',
      message: AUTH_RATE_LIMIT_MESSAGE,
    };
  }

  if (!fields) {
    return {
      status: 'error',
      message: invalidEmailMessage,
    };
  }

  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Enter a valid email.',
    };
  }

  if (!deps.hasPublicEnv()) {
    return {
      status: 'success',
      email: parsed.data.email,
      message:
        'Demo mode: Supabase is not configured yet. Add the emailed code once auth credentials are connected.',
    };
  }

  if (!deps.hasServiceRoleEnv()) {
    return {
      status: 'error',
      message:
        'Supabase admin credentials are required before login approval checks can run.',
    };
  }

  if (!deps.hasLoopsLoginCodeEnv()) {
    return {
      status: 'error',
      message:
        'Loops login code email credentials are required before login codes can be sent.',
    };
  }

  const authorization = await deps.getAuthorization(parsed.data.email);

  if (!authorization.allowed) {
    return {
      status: 'success',
      message: genericLoginMessage,
    };
  }

  const loginCode = await deps.issueLoginCode(parsed.data.email);

  if (!loginCode) {
    return {
      status: 'success',
      message: genericLoginMessage,
    };
  }

  try {
    await deps.sendLoginCodeEmail({
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

export async function verifyLoginCodeFlow(
  formData: FormData | undefined,
  deps: LoginCodeFlowDeps,
): Promise<AuthActionState> {
  const fields = readFormFields(formData, ['email', 'code']);
  const parsed = codeSchema.safeParse({
    email: fields?.email,
    code: fields?.code,
  });

  if (await deps.isRateLimited('verify', parsed.success ? parsed.data.email : null)) {
    return {
      status: 'error',
      email: parsed.success ? parsed.data.email : fields?.email,
      message: AUTH_RATE_LIMIT_MESSAGE,
    };
  }

  if (!fields || !parsed.success) {
    return {
      status: 'error',
      email: fields?.email ?? '',
      message: parsed.success
        ? invalidCodeMessage
        : parsed.error.issues[0]?.message ?? 'Enter the code from your email.',
    };
  }

  if (!deps.hasPublicEnv()) {
    return {
      status: 'error',
      email: parsed.data.email,
      message: 'Supabase is not configured yet, so the code cannot be verified.',
    };
  }

  if (!deps.hasServiceRoleEnv()) {
    return {
      status: 'error',
      email: parsed.data.email,
      message:
        'Supabase admin credentials are required before login approval checks can run.',
    };
  }

  return deps.verifyOtp(parsed.data.email, parsed.data.code);
}
