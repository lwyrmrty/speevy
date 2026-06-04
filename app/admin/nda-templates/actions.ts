'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const fieldsConfigSchema = z.record(z.string(), z.unknown());

const createNdaTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Enter a template name.'),
  description: z.string().trim().max(500).optional(),
  sourceFileUrl: z.string().trim().url('Enter a valid SignatureAPI Library file URL.'),
  fieldsConfig: fieldsConfigSchema.default({}),
  provider: z.string().trim().min(1).default('signatureapi'),
});

const updateNdaTemplateSchema = createNdaTemplateSchema.extend({
  id: z.string().uuid(),
  version: z.number().int().positive().optional(),
});

const archiveNdaTemplateSchema = z.object({
  id: z.string().uuid(),
});

export type NdaTemplateSummary = {
  id: string;
  name: string;
  description: string | null;
  signatureProvider: string;
  sourceFileUrl: string;
  version: number;
  archivedAt: string | null;
  createdAt: string;
};

export type NdaTemplateActionResult =
  | { status: 'success'; message: string; templateId: string }
  | { status: 'error'; message: string };

async function ensureAdmin(): Promise<
  | { ok: true; userId: string }
  | { ok: false; message: string }
> {
  const serverSupabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    return { ok: false, message: 'Sign in as an admin before managing NDA templates.' };
  }

  const supabase = createSupabaseAdminClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    return { ok: false, message: 'Only admins can manage NDA templates.' };
  }

  return { ok: true, userId: user.id };
}

export async function listNdaTemplates(
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<NdaTemplateSummary[]> {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return [];
  }

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('nda_templates')
    .select('id, name, description, signature_provider, source_file_url, version, archived_at, created_at')
    .order('created_at', { ascending: false });

  if (!includeArchived) {
    query = query.is('archived_at', null);
  }

  const { data } = await query;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    signatureProvider: row.signature_provider,
    sourceFileUrl: row.source_file_url,
    version: row.version,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  }));
}

export async function createNdaTemplate(
  payload: z.input<typeof createNdaTemplateSchema>,
): Promise<NdaTemplateActionResult> {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return { status: 'error', message: auth.message };
  }

  const parsed = createNdaTemplateSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Invalid NDA template details.',
    };
  }

  const data = parsed.data;
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data: inserted, error } = await supabase
    .from('nda_templates')
    .insert({
      name: data.name,
      description: data.description || null,
      signature_provider: data.provider,
      source_file_url: data.sourceFileUrl,
      fields_config: data.fieldsConfig,
      created_by_profile_id: auth.userId,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();

  if (error || !inserted) {
    return { status: 'error', message: error?.message ?? 'Could not create the NDA template.' };
  }

  await supabase.from('audit_log').insert({
    actor_profile_id: auth.userId,
    actor_role: 'admin',
    action: 'nda_template.created',
    entity_type: 'nda_template',
    entity_id: inserted.id,
    metadata: { name: data.name, signature_provider: data.provider },
  });

  revalidatePath('/admin/nda-templates');
  return { status: 'success', message: 'NDA template created.', templateId: inserted.id };
}

export async function updateNdaTemplate(
  payload: z.input<typeof updateNdaTemplateSchema>,
): Promise<NdaTemplateActionResult> {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return { status: 'error', message: auth.message };
  }

  const parsed = updateNdaTemplateSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Invalid NDA template details.',
    };
  }

  const data = parsed.data;
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('nda_templates')
    .update({
      name: data.name,
      description: data.description || null,
      signature_provider: data.provider,
      source_file_url: data.sourceFileUrl,
      fields_config: data.fieldsConfig,
      ...(data.version ? { version: data.version } : {}),
      updated_at: now,
    })
    .eq('id', data.id);

  if (error) {
    return { status: 'error', message: error.message };
  }

  await supabase.from('audit_log').insert({
    actor_profile_id: auth.userId,
    actor_role: 'admin',
    action: 'nda_template.updated',
    entity_type: 'nda_template',
    entity_id: data.id,
    metadata: { name: data.name, signature_provider: data.provider },
  });

  revalidatePath('/admin/nda-templates');
  return { status: 'success', message: 'NDA template updated.', templateId: data.id };
}

export async function archiveNdaTemplate(
  payload: z.input<typeof archiveNdaTemplateSchema>,
): Promise<NdaTemplateActionResult> {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return { status: 'error', message: auth.message };
  }

  const parsed = archiveNdaTemplateSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 'error', message: 'Select a valid NDA template to archive.' };
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  // Soft-disable only — never hard delete, so already-signed opportunity_ndas
  // remain attributable to the exact NDA that was signed.
  const { error } = await supabase
    .from('nda_templates')
    .update({ archived_at: now, updated_at: now })
    .eq('id', parsed.data.id)
    .is('archived_at', null);

  if (error) {
    return { status: 'error', message: error.message };
  }

  await supabase.from('audit_log').insert({
    actor_profile_id: auth.userId,
    actor_role: 'admin',
    action: 'nda_template.archived',
    entity_type: 'nda_template',
    entity_id: parsed.data.id,
  });

  revalidatePath('/admin/nda-templates');
  return { status: 'success', message: 'NDA template archived.', templateId: parsed.data.id };
}
