import type { SupabaseClient } from '@supabase/supabase-js';

export const lpProfilePictureBucket = 'opportunity-assets';

export const lpProfilePictureMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export function initialsForInvestorLabel(label: string) {
  return label
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function safeProfilePictureFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildLpProfilePictureStorageKey(lpId: string, fileName: string) {
  return `lp-profiles/${lpId}/profile-${Date.now()}-${safeProfilePictureFileName(fileName)}`;
}

export async function createLpProfilePictureSignedUrl(
  supabase: SupabaseClient,
  storageKey: string | null | undefined,
) {
  if (!storageKey) return null;

  const { data } = await supabase.storage
    .from(lpProfilePictureBucket)
    .createSignedUrl(storageKey, 60 * 60);

  return data?.signedUrl ?? null;
}

export async function ensureLpProfilePictureBucket(supabase: SupabaseClient) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    return listError.message;
  }

  if (buckets?.some((bucket) => bucket.name === lpProfilePictureBucket)) {
    const { error: updateError } = await supabase.storage.updateBucket(lpProfilePictureBucket, {
      public: false,
      fileSizeLimit: '10MB',
      allowedMimeTypes: [...lpProfilePictureMimeTypes],
    });

    return updateError?.message ?? null;
  }

  const { error: createError } = await supabase.storage.createBucket(lpProfilePictureBucket, {
    public: false,
    fileSizeLimit: '10MB',
    allowedMimeTypes: [...lpProfilePictureMimeTypes],
  });

  return createError?.message ?? null;
}
