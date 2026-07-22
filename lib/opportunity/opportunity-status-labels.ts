const opportunityStatusLabels = {
  draft: 'Draft',
  potential: 'Potential',
  upcoming: 'Upcoming',
  active: 'Active',
  closed: 'Closed',
} as const;

export type OpportunityStatus = keyof typeof opportunityStatusLabels;

export function opportunityStatusLabel(status: string) {
  if (status in opportunityStatusLabels) {
    return opportunityStatusLabels[status as OpportunityStatus];
  }

  return status.replaceAll('_', ' ');
}

export function formatOpportunityStatusChange(previousStatus: string, newStatus: string) {
  return `${opportunityStatusLabel(previousStatus)} → ${opportunityStatusLabel(newStatus)}`;
}

const lpBroadcastStatusChanges = new Set<OpportunityStatus>(['active', 'upcoming']);

export function isLpBroadcastStatusChange(status: string): status is OpportunityStatus {
  return lpBroadcastStatusChanges.has(status as OpportunityStatus);
}

export function statusChangeKind(newStatus: string) {
  if (newStatus in opportunityStatusLabels) {
    return newStatus;
  }

  return newStatus.replaceAll('_', ' ');
}

export function formatStatusChangeCallout(newStatus: string, opportunityTitle: string) {
  const title = opportunityTitle.trim() || 'This opportunity';

  if (newStatus === 'active') {
    return `${title} is now Active on Speevy.`;
  }

  if (newStatus === 'upcoming') {
    return `${title} is now Upcoming on Speevy.`;
  }

  return `${title} is now ${opportunityStatusLabel(newStatus)} on Speevy.`;
}

/** Listing copy when Coming Soon flips on (false → true) while status is upcoming. */
export function formatComingSoonListingMessage(opportunityTitle: string) {
  const title = opportunityTitle.trim() || 'This opportunity';
  return `${title} is now marked as Coming Soon, and may be opening for allocation soon.`;
}

/**
 * True when we should send a dedicated Coming Soon broadcast.
 * Requires false → true while status remains upcoming. Status transitions into
 * upcoming fold Coming Soon into the status-change email instead.
 */
export function shouldNotifyComingSoonFlip(input: {
  previousStatus: string;
  newStatus: string;
  previousComingSoon: boolean;
  newComingSoon: boolean;
}) {
  return input.newComingSoon
    && !input.previousComingSoon
    && input.newStatus === 'upcoming'
    && input.previousStatus === 'upcoming';
}

export function formatStatusChangeListingMessage(
  newStatus: string,
  opportunityTitle: string,
  options?: { comingSoon?: boolean },
) {
  const title = opportunityTitle.trim() || 'This opportunity';

  if (newStatus === 'active') {
    return `${title} is now listed as Active, and open for allocation immediately`;
  }

  if (newStatus === 'upcoming') {
    // When an opportunity lands in Upcoming already marked Coming Soon, fold that
    // signal into the status-change email instead of sending a second broadcast.
    if (options?.comingSoon) {
      return formatComingSoonListingMessage(opportunityTitle);
    }

    return `${title} is now listed as Upcoming, and may be opening for allocation soon`;
  }

  return `${title} is now ${opportunityStatusLabel(newStatus)}.`;
}
