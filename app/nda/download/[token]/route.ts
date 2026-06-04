import { NextResponse } from 'next/server';

import { verifyNdaDownloadToken } from '@/lib/nda/tokens';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

// Tokenized signed-NDA download route. The emailed link points here; the token
// is an HMAC-signed (service-role key) reference to one specific
// account_ndas / opportunity_ndas row. On each click we verify the token, look
// up that row's stored PDF, and redirect to a freshly minted, short-lived
// signed Storage URL — so links keep working without exposing the raw storage
// key or a long-lived public URL.
//
// Service-role use is allowed here because the token IS the authorization (it
// proves possession of the emailed link bound to that row) and there is no
// session to read the private bucket with. No PII is logged.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STORAGE_BUCKET = 'nda-documents';
const SIGNED_URL_TTL_SECONDS = 5 * 60; // 5 minutes

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const verified = verifyNdaDownloadToken(token);

  if (!verified) {
    return NextResponse.json({ message: 'This link is invalid or has expired.' }, { status: 404 });
  }

  const supabase = createSupabaseAdminClient();
  const table = verified.tier === 'account' ? 'account_ndas' : 'opportunity_ndas';

  const { data: row } = await supabase
    .from(table)
    .select('signed_document_storage_key')
    .eq('id', verified.rowId)
    .maybeSingle();

  const storageKey = row?.signed_document_storage_key ?? null;
  if (!storageKey) {
    // Signed but not yet stored, or no document — nothing to hand back yet.
    return NextResponse.json({ message: 'This document is not available yet.' }, { status: 404 });
  }

  const { data: signed } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storageKey, SIGNED_URL_TTL_SECONDS);

  if (!signed?.signedUrl) {
    return NextResponse.json({ message: 'Could not prepare the document.' }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
