import { logLpEmailSent } from '@/lib/admin/log-lp-email-sent';
import { buildAppUrl } from '@/lib/app-url';
import { buildLoopsIdempotencyKey } from '@/lib/loops/idempotency';
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
  formatComingSoonListingMessage,
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

type StatusChangeRecipient = {
  lpId: string;
  email: string;
  fullName: string | null;
  matchingSectors: string[];
};

async function loadStatusChangeRecipients(
  opportunitySectors: string[],
  broadcastStatus: string,
): Promise<StatusChangeRecipient[]> {
  const supabase = createSupabaseAdminClient();
  const recipients = new Map<string, StatusChangeRecipient>();

  const { data: lpRows, error: lpError } = await supabase
    .from('lps')
    .select('id, email, full_name, sectors_interested, active_opportunity_notification_preference')
    .eq('status', 'approved');

  if (lpError) {
    console.error('Opportunity status change lookup failed:', lpError.message);
    return [];
  }

  for (const lp of lpRows ?? []) {
    if (!lp.id || !lp.email) {
      continue;
    }

    if (!shouldIncludeLpForStatusChangeBroadcast(lp, opportunitySectors, broadcastStatus)) {
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

  return [...recipients.values()];
}

type OpportunityBroadcastContext = {
  opportunityId: string;
  opportunityTitle: string;
  opportunitySlug: string;
  opportunityTeaser: string | null;
  opportunitySectors: string[];
  opportunityStatus: string;
  targetAllocationCents: number | string | null;
  stage: string | null;
  minimumInvestmentCents: number | string | null;
  savedAt: string;
};

export async function notifyLpsOfOpportunityStatusChange(input: OpportunityBroadcastContext & {
  previousStatus: string;
  newStatus: string;
  /** When true and newStatus is upcoming, fold Coming Soon into the listing message. */
  comingSoon?: boolean;
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

  const recipients = await loadStatusChangeRecipients(opportunitySectors, input.newStatus);
  const statusChangeKindValue = statusChangeKind(input.newStatus);
  const statusChangeCallout = formatStatusChangeCallout(input.newStatus, input.opportunityTitle);
  const statusChangeListingMessage = formatStatusChangeListingMessage(
    input.newStatus,
    input.opportunityTitle,
    { comingSoon: input.comingSoon === true },
  );

  if (recipients.length === 0) {
    console.warn(
      `Opportunity status change skipped for ${input.opportunitySlug}: no eligible LP recipients.`,
    );
    return;
  }

  const results = await mapWithConcurrency(recipients, async (recipient) => {
    const idempotencyKey = buildLoopsIdempotencyKey(
      'lp-opportunity-status-changed',
      input.opportunityId,
      recipient.email,
      input.previousStatus,
      input.newStatus,
      input.savedAt,
    );

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

/**
 * Broadcast when Coming Soon flips false → true on an opportunity that remains
 * `upcoming`. Skipped when the same save also transitions into upcoming — that
 * case is folded into {@link notifyLpsOfOpportunityStatusChange}.
 */
export async function notifyLpsOfComingSoon(input: OpportunityBroadcastContext): Promise<void> {
  if (input.opportunityStatus !== 'upcoming') {
    console.info(
      `Coming Soon emails skipped for ${input.opportunitySlug}: opportunity status is ${input.opportunityStatus}, not upcoming.`,
    );
    return;
  }

  if (!hasLoopsLpOpportunityStatusChangedEnv()) {
    console.error(
      `Coming Soon emails skipped for ${input.opportunitySlug}: LOOPS_TEMPLATE_LP_OPPORTUNITY_STATUS_CHANGED (or LOOPS_API_KEY) is not configured.`,
    );
    return;
  }

  const opportunitySectors = normalizeSectors(input.opportunitySectors);
  const opportunityUrl = buildAppUrl(`/opportunities/${input.opportunitySlug}`);
  const previousStatusLabel = opportunityStatusLabel('upcoming');
  const newStatusLabel = 'Coming Soon';
  const statusChangeSummary = `${previousStatusLabel} → ${newStatusLabel}`;
  const opportunityDetails = buildOpportunityEmailDetails({
    status: input.opportunityStatus,
    teaser: input.opportunityTeaser,
    sectors: opportunitySectors,
    targetAllocationCents: input.targetAllocationCents,
    stage: input.stage,
    minimumInvestmentCents: input.minimumInvestmentCents,
  });

  // Same preference gate as Upcoming status-change broadcasts.
  const recipients = await loadStatusChangeRecipients(opportunitySectors, 'upcoming');
  const statusChangeListingMessage = formatComingSoonListingMessage(input.opportunityTitle);
  const statusChangeCallout = `${input.opportunityTitle.trim() || 'This opportunity'} is now marked as Coming Soon on Speevy.`;

  if (recipients.length === 0) {
    console.warn(
      `Coming Soon emails skipped for ${input.opportunitySlug}: no eligible LP recipients.`,
    );
    return;
  }

  const results = await mapWithConcurrency(recipients, async (recipient) => {
    const idempotencyKey = buildLoopsIdempotencyKey(
      'lp-opportunity-coming-soon',
      input.opportunityId,
      recipient.email,
      false,
      true,
      input.savedAt,
    );

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
        statusChangeKind: 'coming_soon',
        statusChangeCallout,
        statusChangeListingMessage,
        matchingSectors: recipient.matchingSectors.join(', '),
        ...opportunityDetails,
        idempotencyKey,
      }),
      { label: `Coming Soon email to ${recipient.email}` },
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
    `Coming Soon emails for ${input.opportunitySlug}`,
  );
}
