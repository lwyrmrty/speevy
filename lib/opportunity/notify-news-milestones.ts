import { logLpEmailSent } from '@/lib/admin/log-lp-email-sent';
import { buildAppUrl } from '@/lib/app-url';
import {
  mapWithConcurrency,
  summarizeSettledResults,
  withLoopsRetry,
} from '@/lib/loops/rate-limited';
import {
  hasLoopsLpOpportunityUpdatedEnv,
  sendLpOpportunityUpdatedEmail,
} from '@/lib/loops/transactional';
import {
  formatNewsMilestoneSummary,
  type NewsMilestoneItem,
} from '@/lib/opportunity/news-milestones';
import { buildOpportunityEmailDetails } from '@/lib/opportunity/opportunity-email-context';
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
  const [{ data: opportunity, error: opportunityError }, { data: interestRows, error }] = await Promise.all([
    supabase
      .from('opportunities')
      .select('status, teaser, opportunity_sectors, target_allocation_cents, stage, minimum_investment_cents')
      .eq('id', input.opportunityId)
      .maybeSingle(),
    supabase
      .from('interests')
      .select(`
      lp_id,
      lps (
        email,
        full_name
      )
    `)
      .eq('opportunity_id', input.opportunityId)
      .neq('status', 'withdrawn'),
  ]);

  if (opportunityError) {
    console.error('News and milestones opportunity lookup failed:', opportunityError.message);
    return;
  }

  if (error) {
    console.error('News and milestones notification lookup failed:', error.message);
    return;
  }

  const recipients = new Map<string, { lpId: string; email: string; fullName: string | null }>();

  for (const row of interestRows ?? []) {
    const lp = row.lps;
    const lpRecord = Array.isArray(lp) ? lp[0] : lp;
    if (!row.lp_id || !lpRecord?.email) {
      continue;
    }

    recipients.set(lpRecord.email, {
      lpId: row.lp_id,
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
  const opportunityDetails = buildOpportunityEmailDetails({
    status: opportunity?.status ?? 'active',
    teaser: opportunity?.teaser ?? null,
    sectors: opportunity?.opportunity_sectors,
    targetAllocationCents: opportunity?.target_allocation_cents ?? null,
    stage: opportunity?.stage ?? null,
    minimumInvestmentCents: opportunity?.minimum_investment_cents ?? null,
  });

  const results = await mapWithConcurrency([...recipients.values()], async (recipient) => {
    const idempotencyKey = `lp-opportunity-updated-${input.opportunityId}-${recipient.email}-${input.savedAt}`;

    await withLoopsRetry(
      () => sendLpOpportunityUpdatedEmail({
        email: recipient.email,
        firstName: deriveFirstName(recipient.fullName, recipient.email),
        investorName: recipient.fullName || recipient.email,
        opportunityTitle: input.opportunityTitle,
        opportunityUrl,
        updateCount: String(input.newItems.length),
        updateHeadline,
        updateSummary,
        ...opportunityDetails,
        idempotencyKey,
      }),
      { label: `News/milestones email to ${recipient.email}` },
    );

    await logLpEmailSent({
      lpId: recipient.lpId,
      template: 'follower_update',
      opportunityId: input.opportunityId,
      idempotencyKey,
    });
  });

  summarizeSettledResults(
    results,
    `News/milestones emails for ${input.opportunitySlug}`,
  );
}
