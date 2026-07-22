import { logLpEmailSent } from '@/lib/admin/log-lp-email-sent';
import { buildAppUrl } from '@/lib/app-url';
import {
  mapWithConcurrency,
  summarizeSettledResults,
  withLoopsRetry,
} from '@/lib/loops/rate-limited';
import {
  hasLoopsLpOpportunityStatusChangedEnv,
  sendLpOpportunityStatusChangedEmail,
} from '@/lib/loops/transactional';
import {
  findMatchingSectors,
  normalizeSectors,
  shouldIncludeLpForStatusChangeBroadcast,
} from '@/lib/opportunity/broadcast-recipient-selection';
import {
  formatOpportunityStatusChange,
  formatStatusChangeCallout,
  formatStatusChangeListingMessage,
  isLpBroadcastStatusChange,
  opportunityStatusLabel,
  statusChangeKind,
} from '@/lib/opportunity/opportunity-status-labels';
import { buildOpportunityEmailDetails } from '@/lib/opportunity/opportunity-email-context';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

function deriveFirstName(fullName: string | null, email: string) {
  const trimmed = fullName?.trim();
  if (trimmed) {
    return trimmed.split(/\s+/)[0];
  }

  return email;
}

export async function notifyLpsOfOpportunityStatusChange(input: {
  opportunityId: string;
  opportunityTitle: string;
  opportunitySlug: string;
  opportunityTeaser: string | null;
  opportunitySectors: string[];
  opportunityStatus: string;
  targetAllocationCents: number | string | null;
  stage: string | null;
  minimumInvestmentCents: number | string | null;
  previousStatus: string;
  newStatus: string;
  savedAt: string;
}): Promise<void> {
  if (input.previousStatus === input.newStatus || input.newStatus === 'draft') {
    return;
  }

  if (!isLpBroadcastStatusChange(input.newStatus)) {
    console.info(
      `Opportunity status change emails skipped for ${input.opportunitySlug}: ${input.previousStatus} → ${input.newStatus} is not a broadcasted transition.`,
    );
    return;
  }

  if (!hasLoopsLpOpportunityStatusChangedEnv()) {
    console.error(
      `Opportunity status change emails skipped for ${input.opportunitySlug}: LOOPS_TEMPLATE_LP_OPPORTUNITY_STATUS_CHANGED (or LOOPS_API_KEY) is not configured.`,
    );
    return;
  }

  const supabase = createSupabaseAdminClient();
  const opportunitySectors = normalizeSectors(input.opportunitySectors);
  const opportunityUrl = buildAppUrl(`/opportunities/${input.opportunitySlug}`);
  const previousStatusLabel = opportunityStatusLabel(input.previousStatus);
  const newStatusLabel = opportunityStatusLabel(input.newStatus);
  const statusChangeSummary = formatOpportunityStatusChange(
    input.previousStatus,
    input.newStatus,
  );
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

  const { data: lpRows, error: lpError } = await supabase
    .from('lps')
    .select('id, email, full_name, sectors_interested, active_opportunity_notification_preference')
    .eq('status', 'approved');

  if (lpError) {
    console.error('Opportunity status change lookup failed:', lpError.message);
    return;
  }

  for (const lp of lpRows ?? []) {
    if (!lp.id || !lp.email) {
      continue;
    }

    if (!shouldIncludeLpForStatusChangeBroadcast(lp, opportunitySectors, input.newStatus)) {
      continue;
    }

    const matchingSectors = opportunitySectors.length > 0
      ? findMatchingSectors(
          normalizeSectors(lp.sectors_interested),
          opportunitySectors,
        )
      : [];

    recipients.set(lp.email, {
      lpId: lp.id,
      email: lp.email,
      fullName: lp.full_name,
      matchingSectors,
    });
  }

  const statusChangeKindValue = statusChangeKind(input.newStatus);
  const statusChangeCallout = formatStatusChangeCallout(input.newStatus, input.opportunityTitle);
  const statusChangeListingMessage = formatStatusChangeListingMessage(
    input.newStatus,
    input.opportunityTitle,
  );

  if (recipients.size === 0) {
    console.warn(
      `Opportunity status change skipped for ${input.opportunitySlug}: no eligible LP recipients.`,
    );
    return;
  }

  const results = await mapWithConcurrency([...recipients.values()], async (recipient) => {
    const idempotencyKey = `lp-opportunity-status-changed-${input.opportunityId}-${recipient.email}-${input.previousStatus}-${input.newStatus}-${input.savedAt}`;

    await withLoopsRetry(
      () => sendLpOpportunityStatusChangedEmail({
        email: recipient.email,
        firstName: deriveFirstName(recipient.fullName, recipient.email),
        investorName: recipient.fullName || recipient.email,
        opportunityTitle: input.opportunityTitle,
        opportunityUrl,
        previousStatus: previousStatusLabel,
        newStatus: newStatusLabel,
        statusChangeSummary,
        statusChangeKind: statusChangeKindValue,
        statusChangeCallout,
        statusChangeListingMessage,
        matchingSectors: recipient.matchingSectors.join(', '),
        ...opportunityDetails,
        idempotencyKey,
      }),
      { label: `Status change email to ${recipient.email}` },
    );

    await logLpEmailSent({
      lpId: recipient.lpId,
      template: 'status_change',
      opportunityId: input.opportunityId,
      previousStatus: previousStatusLabel,
      newStatus: newStatusLabel,
      idempotencyKey,
    });
  });

  summarizeSettledResults(
    results,
    `Opportunity status change emails for ${input.opportunitySlug}`,
  );
}
