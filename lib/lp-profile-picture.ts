import type { SupabaseClient } from '@supabase/supabase-js';

import { ensureOpportunityAssetsBucket } from '@/lib/opportunity/assets-bucket';

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

export function buildAdminProfilePictureStorageKey(profileId: string, fileName: string) {
  return `admin-profiles/${profileId}/profile-${Date.now()}-${safeProfilePictureFileName(fileName)}`;
}

export const profilePictureMaxBytes = 10 * 1024 * 1024;

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
  const { error } = await ensureOpportunityAssetsBucket(supabase);
  return error;
}
