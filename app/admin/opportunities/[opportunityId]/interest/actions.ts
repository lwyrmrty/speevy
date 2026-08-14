'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import {
  INTEREST_PIPELINE_STATUSES,
  INTEREST_PRIORITIES,
  dollarsInputToCents,
  firstNameFromLabel,
  formatUsdFromCents,
} from '@/lib/interest-crm';
import {
  hasLoopsInterestCrmEmailEnv,
  sendInterestCrmEmail,
} from '@/lib/loops/transactional';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const pipelineStatusSchema = z.enum(INTEREST_PIPELINE_STATUSES);
const prioritySchema = z.enum(INTEREST_PRIORITIES);

const updatePipelineStatusSchema = z.object({
  interestId: z.string().uuid(),
  opportunitySlug: z.string().min(1),
  pipelineStatus: pipelineStatusSchema,
});

const updatePrioritySchema = z.object({
  interestId: z.string().uuid(),
  opportunitySlug: z.string().min(1),
  priority: prioritySchema.nullable(),
});

const updateOwnerSchema = z.object({
  interestId: z.string().uuid(),
  opportunitySlug: z.string().min(1),
  ownerProfileId: z.string().uuid().nullable(),
});

const updateConfirmedAmountSchema = z.object({
  interestId: z.string().uuid(),
  opportunitySlug: z.string().min(1),
  amount: z.string(),
});

const addNoteSchema = z.object({
  interestId: z.string().uuid(),
  opportunitySlug: z.string().min(1),
  body: z.string().trim().min(1).max(4000),
});

export type InterestCrmActionResult =
  | { status: 'success' }
  | { status: 'error'; message: string };

async function ensureAdmin() {
  const serverSupabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    return { ok: false as const, message: 'Sign in as an admin before editing interest.' };
  }

  const supabase = createSupabaseAdminClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name, email')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    return { ok: false as const, message: 'Only admins can edit investor interest.' };
  }

  return { ok: true as const, profile, supabase };
}

async function writeCrmAudit(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  {
    actorProfileId,
    interestId,
    field,
    from,
    to,
  }: {
    actorProfileId: string;
    interestId: string;
    field: string;
    from: unknown;
    to: unknown;
  },
) {
  await supabase.from('audit_log').insert({
    actor_profile_id: actorProfileId,
    actor_role: 'admin',
    action: 'interest.crm_updated',
    entity_type: 'interest',
    entity_id: interestId,
    metadata: { field, from, to },
  });
}

export async function updateInterestPipelineStatus(
  input: z.infer<typeof updatePipelineStatusSchema>,
): Promise<InterestCrmActionResult> {
  const parsed = updatePipelineStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: 'Invalid status update.' };
  }

  const auth = await ensureAdmin();
  if (!auth.ok) {
    return { status: 'error', message: auth.message };
  }

  const { data: existing, error: lookupError } = await auth.supabase
    .from('interests')
    .select('id, pipeline_status')
    .eq('id', parsed.data.interestId)
    .maybeSingle();

  if (lookupError || !existing) {
    return { status: 'error', message: 'Unable to find that interest row.' };
  }

  const { error } = await auth.supabase
    .from('interests')
    .update({ pipeline_status: parsed.data.pipelineStatus })
    .eq('id', parsed.data.interestId);

  if (error) {
    return { status: 'error', message: 'Unable to update status.' };
  }

  await writeCrmAudit(auth.supabase, {
    actorProfileId: auth.profile.id,
    interestId: parsed.data.interestId,
    field: 'pipeline_status',
    from: existing.pipeline_status,
    to: parsed.data.pipelineStatus,
  });

  revalidatePath(`/admin/opportunities/${parsed.data.opportunitySlug}/interest`);
  return { status: 'success' };
}

export async function updateInterestPriority(
  input: z.infer<typeof updatePrioritySchema>,
): Promise<InterestCrmActionResult> {
  const parsed = updatePrioritySchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: 'Invalid priority update.' };
  }

  const auth = await ensureAdmin();
  if (!auth.ok) {
    return { status: 'error', message: auth.message };
  }

  const { data: existing, error: lookupError } = await auth.supabase
    .from('interests')
    .select('id, priority')
    .eq('id', parsed.data.interestId)
    .maybeSingle();

  if (lookupError || !existing) {
    return { status: 'error', message: 'Unable to find that interest row.' };
  }

  const { error } = await auth.supabase
    .from('interests')
    .update({ priority: parsed.data.priority })
    .eq('id', parsed.data.interestId);

  if (error) {
    return { status: 'error', message: 'Unable to update priority.' };
  }

  await writeCrmAudit(auth.supabase, {
    actorProfileId: auth.profile.id,
    interestId: parsed.data.interestId,
    field: 'priority',
    from: existing.priority,
    to: parsed.data.priority,
  });

  revalidatePath(`/admin/opportunities/${parsed.data.opportunitySlug}/interest`);
  return { status: 'success' };
}

export async function updateInterestOwner(
  input: z.infer<typeof updateOwnerSchema>,
): Promise<InterestCrmActionResult> {
  const parsed = updateOwnerSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: 'Invalid owner update.' };
  }

  const auth = await ensureAdmin();
  if (!auth.ok) {
    return { status: 'error', message: auth.message };
  }

  if (parsed.data.ownerProfileId) {
    const { data: owner } = await auth.supabase
      .from('profiles')
      .select('id, role')
      .eq('id', parsed.data.ownerProfileId)
      .eq('role', 'admin')
      .maybeSingle();

    if (!owner) {
      return { status: 'error', message: 'Owner must be a Harpoon admin.' };
    }
  }

  const { data: existing, error: lookupError } = await auth.supabase
    .from('interests')
    .select('id, owner_profile_id')
    .eq('id', parsed.data.interestId)
    .maybeSingle();

  if (lookupError || !existing) {
    return { status: 'error', message: 'Unable to find that interest row.' };
  }

  const { error } = await auth.supabase
    .from('interests')
    .update({ owner_profile_id: parsed.data.ownerProfileId })
    .eq('id', parsed.data.interestId);

  if (error) {
    return { status: 'error', message: 'Unable to update owner.' };
  }

  await writeCrmAudit(auth.supabase, {
    actorProfileId: auth.profile.id,
    interestId: parsed.data.interestId,
    field: 'owner_profile_id',
    from: existing.owner_profile_id,
    to: parsed.data.ownerProfileId,
  });

  revalidatePath(`/admin/opportunities/${parsed.data.opportunitySlug}/interest`);
  return { status: 'success' };
}

export async function updateInterestConfirmedAmount(
  input: z.infer<typeof updateConfirmedAmountSchema>,
): Promise<InterestCrmActionResult> {
  const parsed = updateConfirmedAmountSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: 'Invalid confirmed amount.' };
  }

  const auth = await ensureAdmin();
  if (!auth.ok) {
    return { status: 'error', message: auth.message };
  }

  const confirmedAmountCents = dollarsInputToCents(parsed.data.amount);
  const confirmedAt = confirmedAmountCents === null ? null : new Date().toISOString();
  const confirmedByProfileId = confirmedAmountCents === null ? null : auth.profile.id;

  const { data: existing, error: lookupError } = await auth.supabase
    .from('interests')
    .select('id, confirmed_amount_cents')
    .eq('id', parsed.data.interestId)
    .maybeSingle();

  if (lookupError || !existing) {
    return { status: 'error', message: 'Unable to find that interest row.' };
  }

  const { error } = await auth.supabase
    .from('interests')
    .update({
      confirmed_amount_cents: confirmedAmountCents,
      confirmed_by_profile_id: confirmedByProfileId,
      confirmed_at: confirmedAt,
    })
    .eq('id', parsed.data.interestId);

  if (error) {
    return { status: 'error', message: 'Unable to update confirmed amount.' };
  }

  await writeCrmAudit(auth.supabase, {
    actorProfileId: auth.profile.id,
    interestId: parsed.data.interestId,
    field: 'confirmed_amount_cents',
    from: existing.confirmed_amount_cents,
    to: confirmedAmountCents,
  });

  revalidatePath(`/admin/opportunities/${parsed.data.opportunitySlug}/interest`);
  return { status: 'success' };
}

export async function addInterestNote(
  input: z.infer<typeof addNoteSchema>,
): Promise<InterestCrmActionResult> {
  const parsed = addNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: 'Write a note before saving.' };
  }

  const auth = await ensureAdmin();
  if (!auth.ok) {
    return { status: 'error', message: auth.message };
  }

  const { data: existing, error: lookupError } = await auth.supabase
    .from('interests')
    .select('id')
    .eq('id', parsed.data.interestId)
    .maybeSingle();

  if (lookupError || !existing) {
    return { status: 'error', message: 'Unable to find that interest row.' };
  }

  const { error } = await auth.supabase.from('interest_notes').insert({
    interest_id: parsed.data.interestId,
    author_profile_id: auth.profile.id,
    body: parsed.data.body,
  });

  if (error) {
    return { status: 'error', message: 'Unable to save note.' };
  }

  await auth.supabase.from('audit_log').insert({
    actor_profile_id: auth.profile.id,
    actor_role: 'admin',
    action: 'interest.note_added',
    entity_type: 'interest',
    entity_id: parsed.data.interestId,
    metadata: { body_length: parsed.data.body.length },
  });

  revalidatePath(`/admin/opportunities/${parsed.data.opportunitySlug}/interest`);
  return { status: 'success' };
}

const sendEmailsSchema = z.object({
  opportunitySlug: z.string().min(1),
  interestIds: z.array(z.string().uuid()).min(1),
  body: z.string().trim().min(1).max(20000),
});

function substituteEmailBody(
  template: string,
  vars: {
    investorFirst: string;
    confirmAmount: string;
    opportunity: string;
    senderFirst: string;
  },
) {
  return template
    .replaceAll('#investorfirst', vars.investorFirst)
    .replaceAll('#confirmamount', vars.confirmAmount)
    .replaceAll('#opportunity', vars.opportunity)
    .replaceAll('#senderfirst', vars.senderFirst);
}

function textToHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replaceAll('\n', '<br />')}</p>`)
    .join('');
}

export async function sendInterestCrmEmails(
  input: z.infer<typeof sendEmailsSchema>,
): Promise<{ status: 'success'; sent: number } | { status: 'error'; message: string }> {
  const parsed = sendEmailsSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: 'Select at least one investor and write an email.' };
  }

  const auth = await ensureAdmin();
  if (!auth.ok) {
    return { status: 'error', message: auth.message };
  }

  if (!hasLoopsInterestCrmEmailEnv()) {
    return {
      status: 'error',
      message: 'Add LOOPS_TEMPLATE_INTEREST_CRM_EMAIL to send list emails.',
    };
  }

  const { data: opportunity } = await auth.supabase
    .from('opportunities')
    .select('id, slug, title')
    .eq('slug', parsed.data.opportunitySlug)
    .maybeSingle();

  if (!opportunity) {
    return { status: 'error', message: 'Unable to find that opportunity.' };
  }

  const { data: interestRows, error: interestError } = await auth.supabase
    .from('interests')
    .select(`
      id,
      amount_cents,
      confirmed_amount_cents,
      lps ( email, full_name )
    `)
    .eq('opportunity_id', opportunity.id)
    .in('id', parsed.data.interestIds)
    .neq('status', 'withdrawn');

  if (interestError || !interestRows?.length) {
    return { status: 'error', message: 'Unable to load the selected investors.' };
  }

  const senderFirst = firstNameFromLabel(auth.profile.full_name || auth.profile.email);
  let sent = 0;

  for (const row of interestRows) {
    const lp = Array.isArray(row.lps) ? row.lps[0] : row.lps;
    if (!lp?.email) continue;

    const investorName = lp.full_name || lp.email;
    const investorFirst = firstNameFromLabel(investorName);
    const confirmAmount = formatUsdFromCents(row.confirmed_amount_cents ?? row.amount_cents);
    const messageText = substituteEmailBody(parsed.data.body, {
      investorFirst,
      confirmAmount,
      opportunity: opportunity.title,
      senderFirst,
    });

    await sendInterestCrmEmail({
      email: lp.email,
      firstName: investorFirst,
      confirmAmount,
      opportunityTitle: opportunity.title,
      senderFirst,
      messageHtml: textToHtml(messageText),
      messageText,
      idempotencyKey: `interest-crm-email:${row.id}:${Date.now()}`,
    });
    sent += 1;
  }

  await auth.supabase.from('audit_log').insert({
    actor_profile_id: auth.profile.id,
    actor_role: 'admin',
    action: 'interest.crm_email_sent',
    entity_type: 'opportunity',
    entity_id: opportunity.id,
    metadata: {
      interest_ids: parsed.data.interestIds,
      sent,
    },
  });

  revalidatePath(`/admin/opportunities/${parsed.data.opportunitySlug}/interest`);
  return { status: 'success', sent };
}
