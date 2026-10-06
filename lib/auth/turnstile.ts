const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export const TURNSTILE_FIELD = 'cf-turnstile-response';

export const TURNSTILE_USER_MESSAGE = 'Confirm you are not a robot and try again.';

export function readTurnstileToken(formData: FormData | undefined): string {
  if (!formData || typeof formData.get !== 'function') {
    return '';
  }

  try {
    const value = formData.get(TURNSTILE_FIELD);
    return typeof value === 'string' ? value.trim() : '';
  } catch {
    return '';
  }
}

function siteverifySucceeded(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object' || !('success' in payload)) {
    return false;
  }

  return payload.success === true;
}

// Fail closed. Callers must not log the token or the secret.
export async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim() ?? '';
  if (!secret || !token) {
    return false;
  }

  try {
    const body = new URLSearchParams();
    body.set('secret', secret);
    body.set('response', token);

    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      return false;
    }

    return siteverifySucceeded(await response.json());
  } catch {
    return false;
  }
}

export async function requireTurnstile(
  formData: FormData | undefined,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const token = readTurnstileToken(formData);
  if (!token || !(await verifyTurnstileToken(token))) {
    return { ok: false, message: TURNSTILE_USER_MESSAGE };
  }

  return { ok: true };
}
