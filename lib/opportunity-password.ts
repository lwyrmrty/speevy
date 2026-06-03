import { timingSafeEqual } from 'node:crypto';

// Opportunity gate password comparison. These are shared, admin-chosen
// opportunity-gating secrets (not user account credentials) and are stored as
// retrievable plaintext by product decision. This comparison runs server-side
// only (the public unlock Server Action) and never returns the stored password
// to the client. Uses a constant-time compare to avoid leaking via timing.
export function opportunityPasswordMatches(entered: string, stored: string) {
  const enteredBytes = Buffer.from(entered, 'utf8');
  const storedBytes = Buffer.from(stored, 'utf8');

  if (enteredBytes.length !== storedBytes.length) {
    return false;
  }

  return timingSafeEqual(enteredBytes, storedBytes);
}
