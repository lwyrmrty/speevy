import { createHmac, timingSafeEqual } from 'node:crypto';

import { getSupabaseServiceRoleKey } from '@/lib/supabase/env';

if (typeof window !== 'undefined') {
  throw new Error('lib/opportunity/export-token must only be imported on the server.');
}

const TOKEN_VERSION = 'export-print-v1';
export const EXPORT_PRINT_TTL_MS = 10 * 60 * 1000;

type ExportPrintTokenPayload = {
  v: string;
  o: string;
  e: string;
  t: number;
};

function getSigningSecret() {
  const secret = getSupabaseServiceRoleKey();
  if (!secret) {
    throw new Error('Export print signing secret is not configured.');
  }
  return secret;
}

function base64UrlEncode(input: string) {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function sign(payloadSegment: string) {
  return createHmac('sha256', getSigningSecret()).update(payloadSegment).digest('base64url');
}

export function createExportPrintToken(opportunityId: string, watermarkText: string) {
  const payload: ExportPrintTokenPayload = {
    v: TOKEN_VERSION,
    o: opportunityId,
    e: watermarkText,
    t: Date.now(),
  };
  const payloadSegment = base64UrlEncode(JSON.stringify(payload));
  return `${payloadSegment}.${sign(payloadSegment)}`;
}

export function verifyExportPrintToken(
  token: string | undefined,
  opportunityId: string,
): { watermarkText: string } | null {
  if (!token) {
    return null;
  }

  const [payloadSegment, signatureSegment] = token.split('.');
  if (!payloadSegment || !signatureSegment) {
    return null;
  }

  const expected = Buffer.from(sign(payloadSegment));
  const provided = Buffer.from(signatureSegment);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    // Payload shape is written only by createExportPrintToken.
    const payload = JSON.parse(base64UrlDecode(payloadSegment)) as ExportPrintTokenPayload;
    if (
      payload.v !== TOKEN_VERSION
      || payload.o !== opportunityId
      || typeof payload.e !== 'string'
      || typeof payload.t !== 'number'
      || Date.now() - payload.t > EXPORT_PRINT_TTL_MS
    ) {
      return null;
    }

    return { watermarkText: payload.e };
  } catch {
    return null;
  }
}
