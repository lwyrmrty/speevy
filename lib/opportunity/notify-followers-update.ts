import { buildAppUrl } from '@/lib/app-url';
import {
  hasLoopsLpOpportunityUpdatedEnv,
  sendLpOpportunityUpdatedEmail,
} from '@/lib/loops/transactional';
import {
  formatOpportunityMinimumLabel,
  formatOpportunityRaiseLabel,
  formatOpportunitySectorsLabel,
  formatOpportunityStageLabel,
  formatOpportunityTeaserLabel,
} from '@/lib/opportunity/opportunity-email-context';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

function deriveFirstName(fullName: string | null, email: string) {
  const trimmed = fullName?.trim();
  if (trimmed) {
    return trimmed.split(/\s+/)[0];
  }

  return email;
}

export async function notifyFollowersOfOpportunityUpdate(input: {
  broadcastId: string;
  opportunityId: string;
  opportunitySlug: string;
  opportunityTitle: string;
  opportunityTeaser: string | null;
  opportunitySectors: unknown;
  targetAllocationCents: number | string | null;
  stage: string | null;
  minimumInvestmentCents: number | string | null;
  updateNote: string;
  sentAt: string;
}): Promise<{ recipientCount: number; emailFailures: number; failureMessage?: string }> {
  if (!hasLoopsLpOpportunityUpdatedEnv()) {
    throw new Error('Loops opportunity update email is not configured.');
  }

  const supabase = createSupabaseAdminClient();
  const { data: followRows, error } = await supabase
    .from('opportunity_follows')
    .select(`
      lp_id,
      lps (
        email,
        full_name
      )
    `)
    .eq('opportunity_id', input.opportunityId)
    .is('unfollowed_at', null);

  if (error) {
    throw new Error('Unable to load opportunity followers.');
  }

  const recipients = new Map<string, { email: string; fullName: string | null }>();

  for (const row of followRows ?? []) {
    const lp = row.lps;
    const lpRecord = Array.isArray(lp) ? lp[0] : lp;
    if (!lpRecord?.email) {
      continue;
    }

    recipients.set(lpRecord.email, {
      email: lpRecord.email,
      fullName: lpRecord.full_name,
    });
  }

  if (recipients.size === 0) {
    return { recipientCount: 0, emailFailures: 0 };
  }

  const opportunityUrl = buildAppUrl(`/opportunities/${input.opportunitySlug}`);
  const opportunityTeaser = formatOpportunityTeaserLabel(input.opportunityTeaser);
  const opportunitySectors = formatOpportunitySectorsLabel(input.opportunitySectors);
  const opportunityRaise = formatOpportunityRaiseLabel(input.targetAllocationCents);
  const opportunityStage = formatOpportunityStageLabel(input.stage);
  const opportunityMinimum = formatOpportunityMinimumLabel(input.minimumInvestmentCents);
  const results = await Promise.allSettled(
    [...recipients.values()].map((recipient) =>
      sendLpOpportunityUpdatedEmail({
        email: recipient.email,
        firstName: deriveFirstName(recipient.fullName, recipient.email),
        investorName: recipient.fullName || recipient.email,
        opportunityTitle: input.opportunityTitle,
        opportunityUrl,
        updateCount: '1',
        updateHeadline: 'Update from Harpoon',
        updateSummary: input.updateNote,
        opportunityTeaser,
        opportunitySectors,
        opportunityRaise,
        opportunityStage,
        opportunityMinimum,
        idempotencyKey: `follow-update-${input.broadcastId}-${recipient.email}`,
      }),
    ),
  );

  const emailFailures = results.filter((result) => result.status === 'rejected').length;
  const firstFailure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  const failureMessage = firstFailure?.reason instanceof Error
    ? firstFailure.reason.message
    : undefined;

  if (failureMessage) {
    console.error('Follower update email failed:', failureMessage);
  }

  return { recipientCount: recipients.size, emailFailures, failureMessage };
}
