import {
  hasLoopsLpApprovedEnv,
  sendLpApprovedEmail,
} from '@/lib/loops/transactional';
import { buildAppUrl } from '@/lib/app-url';
import { notifySlackInvestorJoined } from '@/lib/slack/notifications';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type ApprovedInvestorRow = {
  id: string;
  email: string;
  full_name: string | null;
  entity_name: string | null;
  status: string;
};

export type ApprovePendingLpResult =
  | {
      ok: true;
      investor: {
        id: string;
        email: string;
        fullName: string;
        companyName: string;
      };
      approvedAt: string;
    }
  | { ok: false; message: string };

function deriveFirstName(fullName: string | null, email: string) {
  const trimmed = fullName?.trim();
  if (trimmed) {
    return trimmed.split(/\s+/)[0];
  }
  return email;
}

async function sendLpApprovedEmailForInvestor(
  investor: ApprovedInvestorRow,
  approvedAt: string,
) {
  if (!hasLoopsLpApprovedEnv()) {
    return;
  }

  try {
    await sendLpApprovedEmail({
      approvedAt,
      email: investor.email,
      firstName: deriveFirstName(investor.full_name, investor.email),
      investorName: investor.full_name || investor.email,
      loginUrl: buildAppUrl('/login'),
      idempotencyKey: `lp-approved-${investor.id}-${approvedAt}`,
    });
  } catch (error) {
    console.error(
      'LP approved email failed:',
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Approve a pending_review LP via service role. Used by admin UI actions and
 * the Slack interactive Approve button (after signature + Slack admin checks).
 */
export async function approvePendingLp(
  lpId: string,
  context: {
    approvedByProfileId: string | null;
    source: 'admin_ui' | 'slack';
    slackUserId?: string;
  },
): Promise<ApprovePendingLpResult> {
  const supabase = createSupabaseAdminClient();
  const { data: investor, error: fetchError } = await supabase
    .from('lps')
    .select('id, email, full_name, entity_name, status')
    .eq('id', lpId)
    .maybeSingle();

  if (fetchError) {
    return { ok: false, message: fetchError.message };
  }

  if (!investor) {
    return { ok: false, message: 'Investor could not be found.' };
  }

  if (investor.status !== 'pending_review') {
    return {
      ok: false,
      message:
        investor.status === 'approved'
          ? 'This investor is already approved.'
          : 'Only investors pending review can be approved.',
    };
  }

  const approvedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('lps')
    .update({
      status: 'approved',
      approved_at: approvedAt,
      approved_by_profile_id: context.approvedByProfileId,
      updated_at: approvedAt,
    })
    .eq('id', lpId);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  await supabase.from('audit_log').insert({
    actor_profile_id: context.approvedByProfileId,
    actor_role: 'admin',
    action: 'lp.approved',
    entity_type: 'lp',
    entity_id: lpId,
    metadata: {
      source: context.source,
      ...(context.slackUserId ? { slack_user_id: context.slackUserId } : {}),
    },
  });

  await sendLpApprovedEmailForInvestor(investor, approvedAt);

  if (context.source === 'admin_ui') {
    await notifySlackInvestorJoined({
      kind: 'insider',
      investorName: investor.full_name || investor.email,
      investorEmail: investor.email,
      companyName: investor.entity_name,
      joinedAt: approvedAt,
    });
  }

  return {
    ok: true,
    investor: {
      id: investor.id,
      email: investor.email,
      fullName: investor.full_name || investor.email,
      companyName: investor.entity_name || '—',
    },
    approvedAt,
  };
}
