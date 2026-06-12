import { buildAppUrl } from '@/lib/app-url';
import {
  hasLoopsLpOpportunityUpdatedEnv,
  sendLpOpportunityUpdatedEmail,
} from '@/lib/loops/transactional';
import {
  formatNewsMilestoneSummary,
  type NewsMilestoneItem,
} from '@/lib/opportunity/news-milestones';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

function deriveFirstName(fullName: string | null, email: string) {
  const trimmed = fullName?.trim();
  if (trimmed) {
    return trimmed.split(/\s+/)[0];
  }

  return email;
}

export async function notifyInterestedLpsOfNewsMilestones(input: {
  opportunityId: string;
  opportunityTitle: string;
  opportunitySlug: string;
  newItems: NewsMilestoneItem[];
  savedAt: string;
}): Promise<void> {
  if (input.newItems.length === 0 || !hasLoopsLpOpportunityUpdatedEnv()) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const { data: interestRows, error } = await supabase
    .from('interests')
    .select(`
      lp_id,
      lps (
        email,
        full_name
      )
    `)
    .eq('opportunity_id', input.opportunityId)
    .neq('status', 'withdrawn');

  if (error) {
    console.error('News and milestones notification lookup failed:', error.message);
    return;
  }

  const recipients = new Map<string, { email: string; fullName: string | null }>();

  for (const row of interestRows ?? []) {
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
    return;
  }

  const opportunityUrl = buildAppUrl(`/opportunities/${input.opportunitySlug}`);
  const updateHeadline = input.newItems[0]?.title || 'New update';
  const updateSummary = formatNewsMilestoneSummary(input.newItems);

  await Promise.allSettled(
    [...recipients.values()].map((recipient) =>
      sendLpOpportunityUpdatedEmail({
        email: recipient.email,
        firstName: deriveFirstName(recipient.fullName, recipient.email),
        investorName: recipient.fullName || recipient.email,
        opportunityTitle: input.opportunityTitle,
        opportunityUrl,
        updateCount: String(input.newItems.length),
        updateHeadline,
        updateSummary,
        idempotencyKey: `lp-opportunity-updated-${input.opportunityId}-${recipient.email}-${input.savedAt}`,
      }),
    ),
  );
}
