'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { INVESTOR_SECTORS } from '@/lib/investor-request';
import { approvePendingLp } from '@/lib/admin/approve-lp';
import { TAG_COLORS, type Tag } from '@/lib/lp-tags';
import { buildNdaOnboardingUrl } from '@/lib/nda/tokens';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const lpStatusSchema = z.enum(['invited', 'onboarding', 'pending_review', 'approved', 'rejected', 'removed', 'outsider']);

const updateInvestorSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().trim().optional(),
  entityName: z.string().trim().optional(),
  status: lpStatusSchema,
  sectors: z.array(z.enum(INVESTOR_SECTORS)).default([]),
  investmentRangeMin: z.coerce.number().int().nonnegative().nullable(),
  investmentRangeMax: z.coerce.number().int().nonnegative().nullable(),
});

const bulkApproveInvestorsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export type UpdateInvestorResult =
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

async function ensureAdmin(): Promise<
  | { ok: true; message: string; userId: string }
  | { ok: false; message: string }
> {
  const serverSupabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    return { ok: false, message: 'Sign in as an admin before editing investors.' };
  }

  const supabase = createSupabaseAdminClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    return { ok: false, message: 'Only admins can edit investors.' };
  }

  return { ok: true, message: '', userId: user.id };
}

export async function updateInvestor(formData: FormData): Promise<UpdateInvestorResult> {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return { status: 'error', message: auth.message };
  }

  const parsed = updateInvestorSchema.safeParse({
    id: formData.get('id'),
    fullName: formData.get('fullName') ?? '',
    entityName: formData.get('entityName') ?? '',
    status: formData.get('status'),
    sectors: formData.getAll('sectors'),
    investmentRangeMin: formData.get('investmentRangeMin') || null,
    investmentRangeMax: formData.get('investmentRangeMax') || null,
  });

  if (!parsed.success) {
    return { status: 'error', message: 'Please check the investor details and try again.' };
  }

  const data = parsed.data;
  const minCents = data.investmentRangeMin === null ? null : data.investmentRangeMin * 100;
  const maxCents = data.investmentRangeMax === null ? null : data.investmentRangeMax * 100;

  const supabase = createSupabaseAdminClient();
  const { data: existingInvestor, error: existingError } = await supabase
    .from('lps')
    .select('id, email, full_name, status')
    .eq('id', data.id)
    .maybeSingle();

  if (existingError) {
    return { status: 'error', message: existingError.message };
  }

  if (!existingInvestor) {
    return { status: 'error', message: 'Investor could not be found.' };
  }

  const approvedAt = new Date().toISOString();
  const shouldSendApprovalEmail = data.status === 'approved' && existingInvestor.status !== 'approved';
  const { error } = await supabase
    .from('lps')
    .update({
      full_name: data.fullName || null,
      entity_name: data.entityName || null,
      ...(shouldSendApprovalEmail ? {} : { status: data.status }),
      sectors_interested: data.sectors,
      investment_range_min_cents: minCents,
      investment_range_max_cents: maxCents,
      updated_at: approvedAt,
    })
    .eq('id', data.id);

  if (error) {
    return { status: 'error', message: error.message };
  }

  if (shouldSendApprovalEmail) {
    const approval = await approvePendingLp(data.id, {
      approvedByProfileId: auth.userId,
      source: 'admin_ui',
    });

    if (!approval.ok) {
      return { status: 'error', message: approval.message };
    }
  }

  revalidatePath('/admin/investors');
  return { status: 'success', message: 'Investor updated.' };
}

const signedNdaUrlSchema = z.object({
  tier: z.enum(['account', 'opportunity']),
  ndaId: z.string().uuid(),
});

export type SignedNdaUrlResult =
  | { status: 'success'; url: string }
  | { status: 'error'; message: string };

const NDA_STORAGE_BUCKET = 'nda-documents';

// Admin-only: return a short-lived signed URL for a stored, sealed NDA PDF
// (account or per-opportunity). First line validates admin role. The raw storage
// key is never exposed; the URL expires in minutes. See docs/nda-gate-design.md §4B.6.
export async function getInvestorSignedNdaUrl(
  payload: z.input<typeof signedNdaUrlSchema>,
): Promise<SignedNdaUrlResult> {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return { status: 'error', message: auth.message };
  }

  const parsed = signedNdaUrlSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 'error', message: 'Select a valid NDA document.' };
  }

  const supabase = createSupabaseAdminClient();
  const table = parsed.data.tier === 'account' ? 'account_ndas' : 'opportunity_ndas';
  const { data: row } = await supabase
    .from(table)
    .select('signed_document_storage_key')
    .eq('id', parsed.data.ndaId)
    .maybeSingle();

  const storageKey = row?.signed_document_storage_key ?? null;
  if (!storageKey) {
    return { status: 'error', message: 'No signed document is available for this NDA yet.' };
  }

  const { data: signed } = await supabase.storage
    .from(NDA_STORAGE_BUCKET)
    .createSignedUrl(storageKey, 5 * 60);

  if (!signed?.signedUrl) {
    return { status: 'error', message: 'Could not prepare the document. Please try again.' };
  }

  return { status: 'success', url: signed.signedUrl };
}

const investorNdaLinkSchema = z.object({
  lpId: z.string().uuid(),
});

export type InvestorNdaLinkResult =
  | { status: 'success'; url: string }
  | { status: 'error'; message: string };

// Admin-only: mint a fresh account-NDA onboarding link for an investor who has
// not signed yet. Each call issues a new 14-day token via createNdaOnboardingToken.
export async function getInvestorNdaOnboardingUrl(
  payload: z.input<typeof investorNdaLinkSchema>,
): Promise<InvestorNdaLinkResult> {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return { status: 'error', message: auth.message };
  }

  const parsed = investorNdaLinkSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 'error', message: 'Select a valid investor.' };
  }

  const supabase = createSupabaseAdminClient();
  const { data: investor } = await supabase
    .from('lps')
    .select('id')
    .eq('id', parsed.data.lpId)
    .maybeSingle();

  if (!investor) {
    return { status: 'error', message: 'Investor could not be found.' };
  }

  const { data: signedAccountNda } = await supabase
    .from('account_ndas')
    .select('id')
    .eq('lp_id', parsed.data.lpId)
    .eq('status', 'signed')
    .limit(1)
    .maybeSingle();

  if (signedAccountNda) {
    return { status: 'error', message: 'This investor has already signed their account NDA.' };
  }

  return { status: 'success', url: buildNdaOnboardingUrl(parsed.data.lpId) };
}

export async function bulkApproveInvestors(ids: string[]): Promise<UpdateInvestorResult> {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return { status: 'error', message: auth.message };
  }

  const parsed = bulkApproveInvestorsSchema.safeParse({ ids });
  if (!parsed.success) {
    return { status: 'error', message: 'Select at least one valid investor to approve.' };
  }

  const uniqueIds = Array.from(new Set(parsed.data.ids));
  const supabase = createSupabaseAdminClient();
  const { data: investors, error: fetchError } = await supabase
    .from('lps')
    .select('id, email, full_name, status')
    .in('id', uniqueIds);

  if (fetchError) {
    return { status: 'error', message: fetchError.message };
  }

  if ((investors ?? []).length !== uniqueIds.length) {
    return { status: 'error', message: 'One or more selected investors could not be found.' };
  }

  const canApproveAll = (investors ?? []).every((investor) => investor.status === 'pending_review');
  if (!canApproveAll) {
    return { status: 'error', message: 'Only investors pending review can be bulk approved.' };
  }

  for (const id of uniqueIds) {
    const approval = await approvePendingLp(id, {
      approvedByProfileId: auth.userId,
      source: 'admin_ui',
    });

    if (!approval.ok) {
      return { status: 'error', message: approval.message };
    }
  }

  revalidatePath('/admin/investors');
  return {
    status: 'success',
    message: `${uniqueIds.length} ${uniqueIds.length === 1 ? 'investor' : 'investors'} approved.`,
  };
}

// ---------------------------------------------------------------------------
// Investor tags
// Admin-only, freely-creatable labels applied to LPs. See lib/lp-tags.ts and
// supabase/migrations/0016_lp_tags.sql. Every assignment/unassignment writes an
// audit_log row (entity = the LP); tag CRUD writes a tag-scoped audit_log row.
// ---------------------------------------------------------------------------

const tagColorSchema = z.enum(TAG_COLORS);
const tagNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a tag name.')
  .max(50, 'Tag names must be 50 characters or fewer.');

const createTagSchema = z.object({
  name: tagNameSchema,
  color: tagColorSchema.default('gray'),
});

const updateTagSchema = z.object({
  id: z.string().uuid(),
  name: tagNameSchema,
  color: tagColorSchema,
});

const deleteTagSchema = z.object({ id: z.string().uuid() });

const assignTagSchema = z.object({
  lpId: z.string().uuid(),
  tagId: z.string().uuid(),
});

const createAndAssignTagSchema = z.object({
  lpId: z.string().uuid(),
  name: tagNameSchema,
  color: tagColorSchema.default('gray'),
});

const removeTagSchema = assignTagSchema;

type TagRow = { id: string; name: string; color: string; created_at: string };

function toTag(row: TagRow): Tag {
  const color = (TAG_COLORS as readonly string[]).includes(row.color)
    ? (row.color as Tag['color'])
    : 'gray';
  return { id: row.id, name: row.name, color, createdAt: row.created_at };
}

export type TagActionResult =
  | { status: 'success'; message: string; tag?: Tag }
  | { status: 'error'; message: string };

// PostgREST `ilike` interprets % and _ as wildcards; escape them so a
// case-insensitive exact-name lookup stays exact.
function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

async function findTagByName(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  name: string,
): Promise<TagRow | null> {
  const { data } = await supabase
    .from('tags')
    .select('id, name, color, created_at')
    .ilike('name', escapeLikePattern(name))
    .limit(1);

  const candidate = (data ?? [])[0] as TagRow | undefined;
  if (candidate && candidate.name.toLowerCase() === name.toLowerCase()) {
    return candidate;
  }
  return null;
}

export async function createTag(
  payload: z.input<typeof createTagSchema>,
): Promise<TagActionResult> {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return { status: 'error', message: auth.message };
  }

  const parsed = createTagSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid tag.' };
  }

  const data = parsed.data;
  const supabase = createSupabaseAdminClient();

  const existing = await findTagByName(supabase, data.name);
  if (existing) {
    return { status: 'error', message: 'A tag with that name already exists.' };
  }

  const now = new Date().toISOString();
  const { data: inserted, error } = await supabase
    .from('tags')
    .insert({
      name: data.name,
      color: data.color,
      created_by_profile_id: auth.userId,
      created_at: now,
      updated_at: now,
    })
    .select('id, name, color, created_at')
    .single();

  if (error || !inserted) {
    return { status: 'error', message: error?.message ?? 'Could not create the tag.' };
  }

  await supabase.from('audit_log').insert({
    actor_profile_id: auth.userId,
    actor_role: 'admin',
    action: 'tag.created',
    entity_type: 'tag',
    entity_id: inserted.id,
    metadata: { name: data.name, color: data.color },
  });

  revalidatePath('/admin/investors');
  return { status: 'success', message: 'Tag created.', tag: toTag(inserted as TagRow) };
}

export async function updateTag(
  payload: z.input<typeof updateTagSchema>,
): Promise<TagActionResult> {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return { status: 'error', message: auth.message };
  }

  const parsed = updateTagSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid tag.' };
  }

  const data = parsed.data;
  const supabase = createSupabaseAdminClient();

  const existing = await findTagByName(supabase, data.name);
  if (existing && existing.id !== data.id) {
    return { status: 'error', message: 'A tag with that name already exists.' };
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from('tags')
    .update({ name: data.name, color: data.color, updated_at: now })
    .eq('id', data.id)
    .select('id, name, color, created_at')
    .single();

  if (error || !updated) {
    return { status: 'error', message: error?.message ?? 'Could not update the tag.' };
  }

  await supabase.from('audit_log').insert({
    actor_profile_id: auth.userId,
    actor_role: 'admin',
    action: 'tag.updated',
    entity_type: 'tag',
    entity_id: data.id,
    metadata: { name: data.name, color: data.color },
  });

  revalidatePath('/admin/investors');
  return { status: 'success', message: 'Tag updated.', tag: toTag(updated as TagRow) };
}

export async function deleteTag(
  payload: z.input<typeof deleteTagSchema>,
): Promise<TagActionResult> {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return { status: 'error', message: auth.message };
  }

  const parsed = deleteTagSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 'error', message: 'Select a valid tag to delete.' };
  }

  const supabase = createSupabaseAdminClient();
  // lp_tags.tag_id has ON DELETE CASCADE, so assignments are removed with it.
  const { error } = await supabase.from('tags').delete().eq('id', parsed.data.id);

  if (error) {
    return { status: 'error', message: error.message };
  }

  await supabase.from('audit_log').insert({
    actor_profile_id: auth.userId,
    actor_role: 'admin',
    action: 'tag.deleted',
    entity_type: 'tag',
    entity_id: parsed.data.id,
  });

  revalidatePath('/admin/investors');
  return { status: 'success', message: 'Tag deleted.' };
}

async function recordTagAssignment(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  lpId: string,
  tagId: string,
  tagName: string,
): Promise<TagActionResult> {
  const { error } = await supabase
    .from('lp_tags')
    .upsert(
      {
        lp_id: lpId,
        tag_id: tagId,
        assigned_by_profile_id: userId,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'lp_id,tag_id', ignoreDuplicates: true },
    );

  if (error) {
    return { status: 'error', message: error.message };
  }

  await supabase.from('audit_log').insert({
    actor_profile_id: userId,
    actor_role: 'admin',
    action: 'lp.tag_added',
    entity_type: 'lp',
    entity_id: lpId,
    metadata: { tag_id: tagId, tag_name: tagName },
  });

  revalidatePath('/admin/investors');
  return { status: 'success', message: 'Tag added.' };
}

export async function assignTag(
  payload: z.input<typeof assignTagSchema>,
): Promise<TagActionResult> {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return { status: 'error', message: auth.message };
  }

  const parsed = assignTagSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 'error', message: 'Select a valid investor and tag.' };
  }

  const supabase = createSupabaseAdminClient();
  const { data: tag } = await supabase
    .from('tags')
    .select('id, name')
    .eq('id', parsed.data.tagId)
    .maybeSingle();

  if (!tag) {
    return { status: 'error', message: 'That tag could not be found.' };
  }

  return recordTagAssignment(supabase, auth.userId, parsed.data.lpId, tag.id, tag.name);
}

export async function createAndAssignTag(
  payload: z.input<typeof createAndAssignTagSchema>,
): Promise<TagActionResult> {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return { status: 'error', message: auth.message };
  }

  const parsed = createAndAssignTagSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid tag.' };
  }

  const data = parsed.data;
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  // Reuse an existing tag with the same (case-insensitive) name, otherwise
  // create it on the fly.
  let tagRow = await findTagByName(supabase, data.name);
  if (!tagRow) {
    const { data: inserted, error } = await supabase
      .from('tags')
      .insert({
        name: data.name,
        color: data.color,
        created_by_profile_id: auth.userId,
        created_at: now,
        updated_at: now,
      })
      .select('id, name, color, created_at')
      .single();

    if (error || !inserted) {
      return { status: 'error', message: error?.message ?? 'Could not create the tag.' };
    }

    tagRow = inserted as TagRow;

    await supabase.from('audit_log').insert({
      actor_profile_id: auth.userId,
      actor_role: 'admin',
      action: 'tag.created',
      entity_type: 'tag',
      entity_id: tagRow.id,
      metadata: { name: data.name, color: data.color },
    });
  }

  const assignment = await recordTagAssignment(
    supabase,
    auth.userId,
    data.lpId,
    tagRow.id,
    tagRow.name,
  );
  if (assignment.status === 'error') {
    return assignment;
  }

  return { status: 'success', message: 'Tag added.', tag: toTag(tagRow) };
}

export async function removeTag(
  payload: z.input<typeof removeTagSchema>,
): Promise<TagActionResult> {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return { status: 'error', message: auth.message };
  }

  const parsed = removeTagSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 'error', message: 'Select a valid investor and tag.' };
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('lp_tags')
    .delete()
    .eq('lp_id', parsed.data.lpId)
    .eq('tag_id', parsed.data.tagId);

  if (error) {
    return { status: 'error', message: error.message };
  }

  await supabase.from('audit_log').insert({
    actor_profile_id: auth.userId,
    actor_role: 'admin',
    action: 'lp.tag_removed',
    entity_type: 'lp',
    entity_id: parsed.data.lpId,
    metadata: { tag_id: parsed.data.tagId },
  });

  revalidatePath('/admin/investors');
  return { status: 'success', message: 'Tag removed.' };
}
