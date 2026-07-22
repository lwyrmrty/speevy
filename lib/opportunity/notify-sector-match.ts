import { logLpEmailSent } from '@/lib/admin/log-lp-email-sent';
import { buildAppUrl } from '@/lib/app-url';
import { buildLoopsIdempotencyKey } from '@/lib/loops/idempotency';
import {
  mapWithConcurrency,
  summarizeSettledResults,
  withLoopsRetry,
} from '@/lib/loops/rate-limited';
import {
  hasLoopsLpMatchingOpportunityEnv,
  sendLpMatchingOpportunityEmail,
} from '@/lib/loops/transactional';
import {
  findMatchingSectors,
  normalizeSectors,
  shouldIncludeLpForNewOpportunityBroadcast,
} from '@/lib/opportunity/broadcast-recipient-selection';
import { buildOpportunityEmailDetails } from '@/lib/opportunity/opportunity-email-context';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

function deriveFirstName(fullName: string | null, email: string) {
  const trimmed = fullName?.trim();
  if (trimmed) {
    return trimmed.split(/\s+/)[0];
  }

  return email;
}

export async function notifyMatchingLpsOfNewOpportunity(input: {
  opportunityId: string;
  opportunityTitle: string;
  opportunitySlug: string;
  opportunityTeaser: string | null;
  opportunitySectors: string[];
  opportunityStatus: string;
  targetAllocationCents: number | string | null;
  stage: string | null;
  minimumInvestmentCents: number | string | null;
  publishedAt: string;
}): Promise<void> {
  if (!hasLoopsLpMatchingOpportunityEnv()) {
    console.error(
      `New opportunity emails skipped for ${input.opportunitySlug}: LOOPS_TEMPLATE_LP_MATCHING_OPPORTUNITY (or LOOPS_API_KEY) is not configured.`,
    );
    return;
  }

  const opportunitySectors = normalizeSectors(input.opportunitySectors);

  const supabase = createSupabaseAdminClient();
  const { data: lpRows, error } = await supabase
    .from('lps')
    .select('id, email, full_name, sectors_interested, new_opportunity_notification_preference')
    .eq('status', 'approved');

  if (error) {
    console.error('Matching opportunity notification lookup failed:', error.message);
    return;
  }

  const opportunityUrl = buildAppUrl(`/opportunities/${input.opportunitySlug}`);
  const opportunityDetails = buildOpportunityEmailDetails({
    status: input.opportunityStatus,
    teaser: input.opportunityTeaser,
    sectors: opportunitySectors,
    targetAllocationCents: input.targetAllocationCents,
    stage: input.stage,
    minimumInvestmentCents: input.minimumInvestmentCents,
  });

  const recipients = new Map<string, {
    lpId: string;
    email: string;
    fullName: string | null;
    matchingSectors: string[];
  }>();

  for (const lp of lpRows ?? []) {
    if (!lp.id || !lp.email) {
      continue;
    }

    if (!shouldIncludeLpForNewOpportunityBroadcast(lp, opportunitySectors)) {
      continue;
    }

    const matchingSectors = findMatchingSectors(
      normalizeSectors(lp.sectors_interested),
      opportunitySectors,
    );

    recipients.set(lp.email, {
      lpId: lp.id,
      email: lp.email,
      fullName: lp.full_name,
      matchingSectors,
    });
  }

  if (recipients.size === 0) {
    console.warn(
      `New opportunity emails skipped for ${input.opportunitySlug}: no eligible LP recipients.`,
    );
    return;
  }

  const results = await mapWithConcurrency([...recipients.values()], async (recipient) => {
    const idempotencyKey = buildLoopsIdempotencyKey(
      'lp-matching-opportunity',
      input.opportunityId,
      recipient.email,
      input.publishedAt,
    );

    await withLoopsRetry(
      () => sendLpMatchingOpportunityEmail({
        email: recipient.email,
        firstName: deriveFirstName(recipient.fullName, recipient.email),
        investorName: recipient.fullName || recipient.email,
        opportunityTitle: input.opportunityTitle,
        opportunityUrl,
        matchingSectors: recipient.matchingSectors.length > 0
          ? recipient.matchingSectors.join(', ')
          : opportunitySectors.join(', '),
        ...opportunityDetails,
        idempotencyKey,
      }),
      { label: `New opportunity email to ${recipient.email}` },
    );

    await logLpEmailSent({
      lpId: recipient.lpId,
      template: 'new_opportunity',
      opportunityId: input.opportunityId,
      idempotencyKey,
    });
  });

  summarizeSettledResults(
    results,
    `New opportunity emails for ${input.opportunitySlug}`,
  );
}
