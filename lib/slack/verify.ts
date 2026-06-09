import { createHmac, timingSafeEqual } from 'node:crypto';

import { getSlackSigningSecret } from '@/lib/slack/env';

const MAX_REQUEST_AGE_SECONDS = 60 * 5;

export function verifySlackRequestSignature(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
): boolean {
  const signingSecret = getSlackSigningSecret();
  if (!signingSecret || !signatureHeader || !timestampHeader) {
    return false;
  }

  const timestamp = Number.parseInt(timestampHeader, 10);
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (ageSeconds > MAX_REQUEST_AGE_SECONDS) {
    return false;
  }

  const baseString = `v0:${timestampHeader}:${rawBody}`;
  const digest = createHmac('sha256', signingSecret).update(baseString).digest('hex');
  const expected = `v0=${digest}`;

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}
