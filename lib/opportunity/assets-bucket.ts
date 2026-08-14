import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const opportunityAssetsBucket = 'opportunity-assets';

export const opportunityAssetMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
];

export const opportunityAssetFileSizeLimit = '50MB';

export async function ensureOpportunityAssetsBucket(
  supabase: SupabaseClient = createSupabaseAdminClient(),
) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    return { supabase, error: listError.message };
  }

  const options = {
    public: false,
    fileSizeLimit: opportunityAssetFileSizeLimit,
    allowedMimeTypes: opportunityAssetMimeTypes,
  };

  if (buckets?.some((bucket) => bucket.name === opportunityAssetsBucket)) {
    const { error: updateError } = await supabase.storage.updateBucket(
      opportunityAssetsBucket,
      options,
    );

    return { supabase, error: updateError?.message ?? null };
  }

  const { error: createError } = await supabase.storage.createBucket(
    opportunityAssetsBucket,
    options,
  );

  return { supabase, error: createError?.message ?? null };
}
