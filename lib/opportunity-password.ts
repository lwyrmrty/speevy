import { createHash } from 'node:crypto';

// Opportunity password gate hashing. Shared between the admin editor (which sets
// the password) and the public unlock flow (which verifies it) so the two can
// never drift apart.
export function hashOpportunityPassword(password: string) {
  return createHash('sha256').update(password).digest('hex');
}
