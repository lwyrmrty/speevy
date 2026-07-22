import { createHash } from 'node:crypto';

/** Loops rejects Idempotency-Key headers longer than 100 characters. */
export const LOOPS_IDEMPOTENCY_KEY_MAX_LENGTH = 100;

/** 128-bit digest hex — enough uniqueness for email send intents. */
const HASH_HEX_LENGTH = 32;

/**
 * Assert a Loops Idempotency-Key is within the API length limit.
 * Returns the key so callers can use it inline in headers.
 */
export function assertLoopsIdempotencyKey(idempotencyKey: string): string {
  if (idempotencyKey.length > LOOPS_IDEMPOTENCY_KEY_MAX_LENGTH) {
    throw new Error(
      `Loops Idempotency-Key exceeds ${LOOPS_IDEMPOTENCY_KEY_MAX_LENGTH} characters (got ${idempotencyKey.length}).`,
    );
  }

  return idempotencyKey;
}

/**
 * Build a Loops Idempotency-Key that is always under 100 chars.
 *
 * Format: `{prefix}-{sha256(prefix + parts).hex[:32]}`
 *
 * Include every field that distinguishes a unique send intent (opportunity id,
 * recipient email, status transition, savedAt, etc.). Retries with the same
 * parts reuse the same key; a new MatX re-trigger with a new savedAt gets a
 * new key.
 */
export function buildLoopsIdempotencyKey(
  prefix: string,
  ...parts: Array<string | number | boolean | null | undefined>
): string {
  const normalizedPrefix = prefix.trim();
  if (!normalizedPrefix) {
    throw new Error('Loops idempotency key prefix is required.');
  }

  const material = [normalizedPrefix, ...parts.map((part) => String(part ?? ''))].join('\0');
  const digest = createHash('sha256').update(material).digest('hex').slice(0, HASH_HEX_LENGTH);
  const key = `${normalizedPrefix}-${digest}`;

  return assertLoopsIdempotencyKey(key);
}
