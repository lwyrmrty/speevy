import JSZip from 'jszip';

import {
  ensureOpportunityAssetsBucket,
  opportunityAssetsBucket,
} from '@/lib/opportunity/assets-bucket';
import { createExportPrintToken } from '@/lib/opportunity/export-token';
import { buildExportPrintUrl, renderOpportunityOverviewPdf } from '@/lib/opportunity/export-pdf';
import {
  buildExportWatermarkText,
  createConfidentialCoverPdf,
  watermarkImage,
  watermarkPdf,
} from '@/lib/opportunity/export-watermark';
import {
  getExportableDocuments,
  getExportableMedia,
  sanitizeExportFilename,
  type OpportunitySectionRow,
} from '@/lib/opportunity/section-data';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

import type { ExportViewer } from '@/lib/opportunity/export-auth';

function fileExtension(storageKey: string, fallback: string) {
  const match = storageKey.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? fallback;
}

function uniqueZipName(used: Set<string>, base: string, extension: string) {
  let name = `${base}.${extension}`;
  let suffix = 2;

  while (used.has(name.toLowerCase())) {
    name = `${base}-${suffix}.${extension}`;
    suffix += 1;
  }

  used.add(name.toLowerCase());
  return name;
}

async function downloadAsset(storageKey: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(opportunityAssetsBucket)
    .download(storageKey);

  if (error || !data) {
    throw new Error(`Could not download ${storageKey}.`);
  }

  return Buffer.from(await data.arrayBuffer());
}

export async function buildOpportunityExportPack(viewer: ExportViewer) {
  const supabase = createSupabaseAdminClient();
  const { data: sections, error } = await supabase
    .from('opportunity_sections')
    .select('type, position, data')
    .eq('opportunity_id', viewer.opportunityId)
    .order('position', { ascending: true });

  if (error) {
    throw new Error('Could not load opportunity sections.');
  }

  // jsonb `data` is a section-field map written by the editor.
  const orderedSections = (sections ?? []) as OpportunitySectionRow[];
  const documents = orderedSections.flatMap(getExportableDocuments);
  const media = orderedSections.flatMap(getExportableMedia);
  const watermarkText = buildExportWatermarkText(viewer.email, viewer.title);
  const printToken = createExportPrintToken(viewer.opportunityId, watermarkText);
  const overviewPdf = await watermarkPdf(
    new Uint8Array(await renderOpportunityOverviewPdf(buildExportPrintUrl(viewer.slug, printToken))),
    watermarkText,
  );

  const packName = sanitizeExportFilename(viewer.title);
  const zip = new JSZip();
  const root = zip.folder(packName);
  if (!root) {
    throw new Error('Could not create export archive.');
  }

  root.file(`${packName} Overview.pdf`, overviewPdf);

  const documentNames = new Set<string>();
  for (const document of documents) {
    const bytes = await downloadAsset(document.storageKey);
    const base = sanitizeExportFilename(document.title);
    const extension = fileExtension(document.storageKey, 'pdf');
    const filename = uniqueZipName(documentNames, base, extension);
    const folder = root.folder('documents');
    if (!folder) {
      throw new Error('Could not create documents folder.');
    }

    if (extension === 'pdf') {
      folder.file(filename, await watermarkPdf(new Uint8Array(bytes), watermarkText));
      continue;
    }

    folder.file(filename, bytes);
    if (extension === 'docx') {
      const coverName = uniqueZipName(documentNames, `${base}-CONFIDENTIAL`, 'pdf');
      folder.file(coverName, await createConfidentialCoverPdf(document.title, watermarkText));
    }
  }

  const mediaNames = new Set<string>();
  for (const item of media) {
    const bytes = await downloadAsset(item.storageKey);
    const watermarked = await watermarkImage(bytes, watermarkText);
    const extension = fileExtension(item.storageKey, 'png');
    const filename = uniqueZipName(mediaNames, sanitizeExportFilename(item.title), extension);
    const folder = root.folder('media');
    if (!folder) {
      throw new Error('Could not create media folder.');
    }
    folder.file(filename, watermarked);
  }

  const zipBytes = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const { error: bucketError } = await ensureOpportunityAssetsBucket(supabase);
  if (bucketError) {
    throw new Error(bucketError);
  }

  const downloadName = `${packName}.zip`;
  const storageKey = `exports/${viewer.opportunityId}/${Date.now()}-${viewer.slug}.zip`;
  const { error: uploadError } = await supabase.storage
    .from(opportunityAssetsBucket)
    .upload(storageKey, Buffer.from(zipBytes), {
      contentType: 'application/zip',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(uploadError.message || 'Could not store the export package.');
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from(opportunityAssetsBucket)
    .createSignedUrl(storageKey, 10 * 60, {
      download: downloadName,
    });

  if (signedError || !signed?.signedUrl) {
    throw new Error('Could not create a download link for the export.');
  }

  await supabase.from('audit_log').insert({
    actor_profile_id: viewer.profileId,
    actor_role: viewer.kind === 'admin' ? 'admin' : 'lp',
    action: 'opportunity.exported',
    entity_type: 'opportunity',
    entity_id: viewer.opportunityId,
    metadata: {
      slug: viewer.slug,
      source: viewer.kind,
      document_count: documents.length,
      media_count: media.length,
    },
  });

  return { url: signed.signedUrl, filename: downloadName, storageKey };
}
