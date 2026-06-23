import type { createSupabaseAdminClient } from '@/lib/supabase/admin';

type AdminSupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

export function isActiveOpportunityFollow(row: { unfollowed_at: string | null } | null) {
  return Boolean(row && row.unfollowed_at === null);
}

export async function ensureOpportunityFollow(
  supabase: AdminSupabaseClient,
  {
    actorProfileId,
    lpId,
    opportunityId,
    source,
  }: {
    actorProfileId: string | null;
    lpId: string;
    opportunityId: string;
    source: 'lp' | 'password_gate' | 'interest';
  },
): Promise<void> {
  const followedAt = new Date().toISOString();
  const { data: existing } = await supabase
    .from('opportunity_follows')
    .select('id, unfollowed_at')
    .eq('opportunity_id', opportunityId)
    .eq('lp_id', lpId)
    .maybeSingle();

  if (existing && existing.unfollowed_at === null) {
    return;
  }

  const { error } = await supabase
    .from('opportunity_follows')
    .upsert(
      {
        opportunity_id: opportunityId,
        lp_id: lpId,
        followed_at: followedAt,
        unfollowed_at: null,
      },
      { onConflict: 'opportunity_id,lp_id' },
    );

  if (error) {
    console.error('Auto-follow on interest failed:', error.message);
    return;
  }

  await supabase.from('audit_log').insert({
    actor_profile_id: actorProfileId,
    actor_role: 'lp',
    action: 'opportunity.followed',
    entity_type: 'opportunity',
    entity_id: opportunityId,
    metadata: {
      lp_id: lpId,
      source,
      auto: source === 'interest',
    },
  });
}

export async function setOpportunityFollow(
  supabase: AdminSupabaseClient,
  {
    actorProfileId,
    following,
    lpId,
    opportunityId,
  }: {
    actorProfileId: string;
    following: boolean;
    lpId: string;
    opportunityId: string;
  },
): Promise<{ error: string | null }> {
  const now = new Date().toISOString();

  if (following) {
    const { data: existing } = await supabase
      .from('opportunity_follows')
      .select('id, unfollowed_at')
      .eq('opportunity_id', opportunityId)
      .eq('lp_id', lpId)
      .maybeSingle();

    if (existing && existing.unfollowed_at === null) {
      return { error: null };
    }

    const { error } = await supabase
      .from('opportunity_follows')
      .upsert(
        {
          opportunity_id: opportunityId,
          lp_id: lpId,
          followed_at: now,
          unfollowed_at: null,
        },
        { onConflict: 'opportunity_id,lp_id' },
      );

    if (error) {
      return { error: 'Unable to follow this opportunity. Please try again.' };
    }

    await supabase.from('audit_log').insert({
      actor_profile_id: actorProfileId,
      actor_role: 'lp',
      action: 'opportunity.followed',
      entity_type: 'opportunity',
      entity_id: opportunityId,
      metadata: { lp_id: lpId, source: 'lp' },
    });

    return { error: null };
  }

  const { data: existing } = await supabase
    .from('opportunity_follows')
    .select('id')
    .eq('opportunity_id', opportunityId)
    .eq('lp_id', lpId)
    .is('unfollowed_at', null)
    .maybeSingle();

  if (!existing) {
    return { error: null };
  }

  const { error } = await supabase
    .from('opportunity_follows')
    .update({ unfollowed_at: now })
    .eq('id', existing.id);

  if (error) {
    return { error: 'Unable to unfollow this opportunity. Please try again.' };
  }

  await supabase.from('audit_log').insert({
    actor_profile_id: actorProfileId,
    actor_role: 'lp',
    action: 'opportunity.unfollowed',
    entity_type: 'opportunity',
    entity_id: opportunityId,
    metadata: { lp_id: lpId, source: 'lp' },
  });

  return { error: null };
}
