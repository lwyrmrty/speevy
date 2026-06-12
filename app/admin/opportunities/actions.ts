'use server';

import { z } from 'zod';

import { INVESTOR_SECTORS } from '@/lib/investor-request';
import {
  extractNewsMilestoneItemsFromSections,
  findNewNewsMilestoneItems,
} from '@/lib/opportunity/news-milestones';
import { notifyInterestedLpsOfNewsMilestones } from '@/lib/opportunity/notify-news-milestones';
import { notifyMatchingLpsOfNewOpportunity } from '@/lib/opportunity/notify-sector-match';
import { notifyLpsOfOpportunityStatusChange } from '@/lib/opportunity/notify-status-change';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const statusSchema = z.enum(['draft', 'potential', 'upcoming', 'active', 'closed']);
const opportunityAssetKindSchema = z.enum(['thumbnail', 'logo', 'section', 'document']);
const opportunityAssetsBucket = 'opportunity-assets';
const opportunityAssetMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const documentAssetMimeTypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const sectionSchema = z.object({
  clientId: z.number(),
  type: z.string().min(1),
  position: z.number().int().nonnegative(),
  data: z.record(z.string(), z.unknown()),
});

const saveOpportunitySchema = z.object({
  slug: z.string().trim().min(1),
  createNew: z.boolean().optional(),
  status: statusSchema,
  comingSoon: z.boolean(),
  title: z.string().trim().min(1),
  teaser: z.string().trim().optional(),
  sectors: z.array(z.enum(INVESTOR_SECTORS)).default([]),
  stage: z.string().trim().optional(),
  targetRaise: z.string().trim().optional(),
  minimumCheck: z.string().trim().optional(),
  originationFee: z.string().trim().optional(),
  carry: z.string().trim().optional(),
  managementFee: z.string().trim().optional(),
  websiteUrl: z.string().trim().optional(),
  linkedinUrl: z.string().trim().optional(),
  twitterUrl: z.string().trim().optional(),
  ndaRequired: z.boolean(),
  // References an nda_templates.id (Speevy NDA catalog). Required when NDA is on.
  ndaTemplateId: z.string().uuid().nullable().optional(),
  watermarkEnabled: z.boolean(),
  passwordProtected: z.boolean(),
  password: z.string().optional(),
  thumbnailStorageKey: z.string().optional(),
  logoStorageKey: z.string().optional(),
  sections: z.array(sectionSchema),
}).superRefine((data, ctx) => {
  if (data.ndaRequired && !data.ndaTemplateId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ndaTemplateId'],
      message: 'Select an NDA document before saving an NDA-required opportunity.',
    });
  }
});

export type SaveOpportunityPayload = z.infer<typeof saveOpportunitySchema>;

export type SaveOpportunityResult =
  | { status: 'success'; opportunityId: string; slug: string; savedAt: string }
  | { status: 'error'; message: string };

export type UploadOpportunityAssetResult =
  | { status: 'success'; storageKey: string; signedUrl: string }
  | { status: 'error'; message: string };

async function getAdminProfile() {
  const serverSupabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    return { profile: null, error: 'Sign in as an admin before saving.' };
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await adminSupabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || profile?.role !== 'admin') {
    return { profile: null, error: 'Only admins can save opportunities.' };
  }

  return { profile, error: null };
}

function moneyToCents(value?: string) {
  const digits = value?.replace(/[^\d]/g, '') ?? '';
  return digits ? Number(digits) * 100 : null;
}

function percentToBasisPoints(value?: string) {
  const cleaned = value?.replace(/[^\d.]/g, '') ?? '';
  return cleaned ? Math.round(Number(cleaned) * 100) : null;
}

function safeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'opportunity';
}

async function uniqueOpportunitySlug(supabase: ReturnType<typeof createSupabaseAdminClient>, value: string) {
  const baseSlug = slugify(value);
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const { data: existingOpportunity } = await supabase
      .from('opportunities')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();

    if (!existingOpportunity) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function ensureOpportunityAssetsBucket() {
  const supabase = createSupabaseAdminClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    return { supabase, error: listError.message };
  }

  if (buckets?.some((bucket) => bucket.name === opportunityAssetsBucket)) {
    const { error: updateError } = await supabase.storage.updateBucket(opportunityAssetsBucket, {
      public: false,
      fileSizeLimit: '10MB',
      allowedMimeTypes: opportunityAssetMimeTypes,
    });

    return { supabase, error: updateError?.message ?? null };
  }

  const { error: createError } = await supabase.storage.createBucket(opportunityAssetsBucket, {
    public: false,
    fileSizeLimit: '10MB',
    allowedMimeTypes: opportunityAssetMimeTypes,
  });

  return { supabase, error: createError?.message ?? null };
}

export async function uploadOpportunityAsset(
  formData: FormData,
): Promise<UploadOpportunityAssetResult> {
  const { error: authError } = await getAdminProfile();

  if (authError) {
    return { status: 'error', message: authError };
  }

  const slug = z.string().trim().min(1).safeParse(formData.get('slug'));
  const kind = opportunityAssetKindSchema.safeParse(formData.get('kind'));
  const file = formData.get('file');

  if (!slug.success || !kind.success || !(file instanceof File)) {
    return { status: 'error', message: 'Choose a file to upload.' };
  }

  const isDocumentUpload = kind.data === 'document';
  const isDocumentFile = documentAssetMimeTypes.includes(file.type);
  const isImage = file.type.startsWith('image/');

  if (isDocumentUpload ? !isDocumentFile : !isImage) {
    return {
      status: 'error',
      message: isDocumentUpload
        ? 'Only PDF or DOCX uploads are supported for documents.'
        : 'Only image uploads are supported here.',
    };
  }

  const { supabase, error: bucketError } = await ensureOpportunityAssetsBucket();

  if (bucketError) {
    return { status: 'error', message: bucketError };
  }

  const storageKey = `opportunities/${slug.data}/${kind.data}-${Date.now()}-${safeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from(opportunityAssetsBucket)
    .upload(storageKey, file, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return { status: 'error', message: uploadError.message };
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(opportunityAssetsBucket)
    .createSignedUrl(storageKey, 60 * 60);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    return {
      status: 'error',
      message: signedUrlError?.message ?? 'Image uploaded, but preview URL failed.',
    };
  }

  return {
    status: 'success',
    storageKey,
    signedUrl: signedUrlData.signedUrl,
  };
}

export async function saveOpportunityDraft(
  payload: SaveOpportunityPayload,
): Promise<SaveOpportunityResult> {
  const parsed = saveOpportunitySchema.safeParse(payload);

  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Invalid opportunity payload.',
    };
  }

  const { profile, error: authError } = await getAdminProfile();

  if (authError || !profile) {
    return { status: 'error', message: authError ?? 'Only admins can save opportunities.' };
  }

  const adminSupabase = createSupabaseAdminClient();
  const data = parsed.data;
  const password = data.password?.trim() ?? '';
  const slug = data.createNew
    ? await uniqueOpportunitySlug(adminSupabase, data.slug)
    : data.slug;

  const savedAt = new Date().toISOString();
  const { data: existingOpportunity } = data.createNew
    ? { data: null }
    : await adminSupabase
        .from('opportunities')
        .select('id, published_at, status')
        .eq('slug', slug)
        .maybeSingle();

  const { data: existingSections } = existingOpportunity
    ? await adminSupabase
        .from('opportunity_sections')
        .select('type, data')
        .eq('opportunity_id', existingOpportunity.id)
    : { data: null };

  // The editor seeds the field with the actual saved password, so a blank field
  // means the admin intentionally cleared it. A password-protected opportunity
  // must always have a gate password.
  if (data.passwordProtected && !password) {
    return {
      status: 'error',
      message: 'Enter a password before saving a password-protected opportunity.',
    };
  }

  const shouldBePublished = data.status !== 'draft';
  const opportunityFields = {
    slug,
    title: data.title,
    company_name: data.title,
    teaser: data.teaser || null,
    opportunity_sectors: data.sectors,
    status: data.status,
    coming_soon: data.status === 'upcoming' ? data.comingSoon : false,
    minimum_investment_cents: moneyToCents(data.minimumCheck),
    target_allocation_cents: moneyToCents(data.targetRaise),
    origination_fee_cents: moneyToCents(data.originationFee),
    stage: data.stage || null,
    carry_percentage_basis_points: percentToBasisPoints(data.carry),
    management_fee_basis_points: percentToBasisPoints(data.managementFee),
    website_url: data.websiteUrl || null,
    linkedin_url: data.linkedinUrl || null,
    twitter_url: data.twitterUrl || null,
    nda_required: data.ndaRequired,
    nda_template_id: data.ndaRequired ? data.ndaTemplateId ?? null : null,
    watermark_enabled: data.watermarkEnabled,
    password_protected: data.passwordProtected,
    thumbnail_storage_key: data.thumbnailStorageKey || null,
    logo_storage_key: data.logoStorageKey || null,
    published_at: shouldBePublished ? existingOpportunity?.published_at ?? savedAt : null,
    updated_at: savedAt,
  };

  const opportunityMutation = existingOpportunity
    ? adminSupabase
        .from('opportunities')
        .update(opportunityFields)
        .eq('id', existingOpportunity.id)
        .select('id')
        .single()
    : adminSupabase
        .from('opportunities')
        .insert({
          ...opportunityFields,
          created_by_profile_id: profile.id,
        })
        .select('id')
        .single();

  const { data: opportunity, error: opportunityError } = await opportunityMutation;

  if (opportunityError || !opportunity) {
    return {
      status: 'error',
      message: opportunityError?.message ?? 'Could not save opportunity.',
    };
  }

  // Gate password lives in its own LP-inaccessible table. Upsert it when the
  // opportunity is password protected; otherwise remove any stored password.
  if (data.passwordProtected) {
    const { error: passwordError } = await adminSupabase
      .from('opportunity_access_passwords')
      .upsert(
        {
          opportunity_id: opportunity.id,
          password,
          updated_at: savedAt,
        },
        { onConflict: 'opportunity_id' },
      );

    if (passwordError) {
      return { status: 'error', message: passwordError.message };
    }
  } else {
    const { error: passwordDeleteError } = await adminSupabase
      .from('opportunity_access_passwords')
      .delete()
      .eq('opportunity_id', opportunity.id);

    if (passwordDeleteError) {
      return { status: 'error', message: passwordDeleteError.message };
    }
  }

  const { error: deleteSectionsError } = await adminSupabase
    .from('opportunity_sections')
    .delete()
    .eq('opportunity_id', opportunity.id);

  if (deleteSectionsError) {
    return { status: 'error', message: deleteSectionsError.message };
  }

  if (data.sections.length > 0) {
    const { error: sectionsError } = await adminSupabase
      .from('opportunity_sections')
      .insert(
        data.sections.map((section) => ({
          opportunity_id: opportunity.id,
          type: section.type,
          position: section.position,
          data: section.data,
          updated_at: savedAt,
        })),
      );

    if (sectionsError) {
      return { status: 'error', message: sectionsError.message };
    }
  }

  const previousStatus = existingOpportunity?.status ?? 'draft';

  if (previousStatus !== data.status) {
    await notifyLpsOfOpportunityStatusChange({
      opportunityId: opportunity.id,
      opportunityTitle: data.title,
      opportunitySlug: slug,
      opportunitySectors: data.sectors,
      previousStatus,
      newStatus: data.status,
      savedAt,
    });
  }

  if (data.status !== 'draft') {
    const isFirstPublication = !existingOpportunity?.published_at;

    if (isFirstPublication) {
      await notifyMatchingLpsOfNewOpportunity({
        opportunityId: opportunity.id,
        opportunityTitle: data.title,
        opportunitySlug: slug,
        opportunityTeaser: data.teaser || null,
        opportunitySectors: data.sectors,
        publishedAt: opportunityFields.published_at ?? savedAt,
      });
    }

    const previousItems = extractNewsMilestoneItemsFromSections(
      (existingSections ?? []).map((section) => ({
        type: section.type,
        data: (section.data ?? {}) as Record<string, unknown>,
      })),
    );
    const nextItems = extractNewsMilestoneItemsFromSections(data.sections);
    const newItems = findNewNewsMilestoneItems(previousItems, nextItems);

    if (newItems.length > 0) {
      await notifyInterestedLpsOfNewsMilestones({
        opportunityId: opportunity.id,
        opportunityTitle: data.title,
        opportunitySlug: slug,
        newItems,
        savedAt,
      });
    }
  }

  return { status: 'success', opportunityId: opportunity.id, slug, savedAt };
}
