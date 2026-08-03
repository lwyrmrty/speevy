'use client';

import {
  finalizeOpportunityAssetUpload,
  prepareOpportunityAssetUpload,
  type UploadOpportunityAssetResult,
} from '@/app/admin/opportunities/actions';

type OpportunityAssetKind = 'thumbnail' | 'logo' | 'section' | 'document';

/**
 * Upload an opportunity asset directly from the browser to Supabase Storage
 * using a short-lived signed upload URL. Avoids Vercel's ~4.5MB Server Action
 * body limit that blocks typical pitch-deck PDFs.
 */
export async function uploadOpportunityAssetDirect(input: {
  slug: string;
  kind: OpportunityAssetKind;
  file: File;
}): Promise<UploadOpportunityAssetResult> {
  const prepared = await prepareOpportunityAssetUpload({
    slug: input.slug,
    kind: input.kind,
    fileName: input.file.name,
    contentType: input.file.type || 'application/octet-stream',
    fileSize: input.file.size,
  });

  if (prepared.status === 'error') {
    return prepared;
  }

  const body = new FormData();
  body.append('cacheControl', '3600');
  body.append('', input.file);

  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(prepared.uploadUrl, {
      method: 'PUT',
      body,
      headers: {
        'x-upsert': 'true',
      },
    });
  } catch {
    return {
      status: 'error',
      message: 'Upload failed. Check your connection and try again.',
    };
  }

  if (!uploadResponse.ok) {
    return {
      status: 'error',
      message: `Upload failed (${uploadResponse.status}). Try a smaller file or retry.`,
    };
  }

  return finalizeOpportunityAssetUpload({ storageKey: prepared.storageKey });
}
