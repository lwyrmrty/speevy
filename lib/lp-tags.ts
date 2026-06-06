import type { SupabaseClient } from '@supabase/supabase-js';

// Tag colors mirror the Untitled UI Badge palette (components/base/badges).
// Stored as text on `tags.color` (DB CHECK constraint keeps them in sync) and
// validated against this list in the Server Actions.
export const TAG_COLORS = [
  'gray',
  'brand',
  'error',
  'warning',
  'success',
  'slate',
  'sky',
  'blue',
  'indigo',
  'purple',
  'pink',
  'orange',
  'teal',
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

export const DEFAULT_TAG_COLOR: TagColor = 'gray';

export type Tag = {
  id: string;
  name: string;
  color: TagColor;
  createdAt: string;
};

export function normalizeTagColor(value: unknown): TagColor {
  return (TAG_COLORS as readonly string[]).includes(value as string)
    ? (value as TagColor)
    : DEFAULT_TAG_COLOR;
}

type TagRow = {
  id: string;
  name: string;
  color: string;
  created_at: string;
};

function toTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    color: normalizeTagColor(row.color),
    createdAt: row.created_at,
  };
}

// All tags, alphabetised for the picker. Admin-only data (RLS + service role).
export async function listTags(supabase: SupabaseClient): Promise<Tag[]> {
  const { data } = await supabase
    .from('tags')
    .select('id, name, color, created_at')
    .order('name', { ascending: true });

  return ((data ?? []) as TagRow[]).map(toTag);
}

export type TagWithCount = Tag & { lpCount: number };

// All tags plus how many LPs each is assigned to, for the management surface.
// Counts are derived from a single lp_tags scan — cheap at our volume.
export async function listTagsWithCounts(
  supabase: SupabaseClient,
): Promise<TagWithCount[]> {
  const tags = await listTags(supabase);

  const { data } = await supabase.from('lp_tags').select('tag_id');
  const counts = new Map<string, number>();
  ((data ?? []) as { tag_id: string }[]).forEach((row) => {
    counts.set(row.tag_id, (counts.get(row.tag_id) ?? 0) + 1);
  });

  return tags.map((tag) => ({ ...tag, lpCount: counts.get(tag.id) ?? 0 }));
}

type LpTagJoinRow = {
  lp_id: string;
  tags: TagRow | TagRow[] | null;
};

function firstTag(value: LpTagJoinRow['tags']): TagRow | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

// Map of lp_id -> assigned tags (alphabetised), for the given LP ids.
export async function getTagsForLpIds(
  supabase: SupabaseClient,
  lpIds: string[],
): Promise<Map<string, Tag[]>> {
  const result = new Map<string, Tag[]>();
  lpIds.forEach((id) => result.set(id, []));

  if (lpIds.length === 0) {
    return result;
  }

  const { data } = await supabase
    .from('lp_tags')
    .select('lp_id, tags ( id, name, color, created_at )')
    .in('lp_id', lpIds);

  ((data ?? []) as LpTagJoinRow[]).forEach((row) => {
    const tagRow = firstTag(row.tags);
    if (!tagRow) return;

    const bucket = result.get(row.lp_id);
    if (bucket) {
      bucket.push(toTag(tagRow));
    }
  });

  for (const bucket of result.values()) {
    bucket.sort((a, b) => a.name.localeCompare(b.name));
  }

  return result;
}
