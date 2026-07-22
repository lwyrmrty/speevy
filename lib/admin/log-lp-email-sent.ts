import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const LP_EMAIL_TEMPLATE_KINDS = [
  'new_opportunity',
  'status_change',
  'follower_update',
  'signup_received',
  'approved',
  'nda_copy',
] as const;

export type LpEmailTemplateKind = (typeof LP_EMAIL_TEMPLATE_KINDS)[number];

export async function logLpEmailSent(input: {
  lpId: string;
  template: LpEmailTemplateKind;
  opportunityId?: string | null;
  previousStatus?: string | null;
  newStatus?: string | null;
  ndaName?: string | null;
  idempotencyKey?: string | null;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.from('audit_log').insert({
    actor_profile_id: null,
    actor_role: 'admin',
    action: 'email.sent',
    entity_type: 'lp',
    entity_id: input.lpId,
    metadata: {
      template: input.template,
      lp_id: input.lpId,
      ...(input.opportunityId ? { opportunity_id: input.opportunityId } : {}),
      ...(input.previousStatus ? { previous_status: input.previousStatus } : {}),
      ...(input.newStatus ? { new_status: input.newStatus } : {}),
      ...(input.ndaName ? { nda_name: input.ndaName } : {}),
      ...(input.idempotencyKey ? { idempotency_key: input.idempotencyKey } : {}),
    },
  });

  if (error) {
    console.error('email.sent audit log failed:', error.message);
  }
}
