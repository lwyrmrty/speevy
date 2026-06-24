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

export function formatStatusChangeListingMessage(newStatus: string, opportunityTitle: string) {
  const title = opportunityTitle.trim() || 'This opportunity';

  if (newStatus === 'active') {
    return `${title} is now listed as Active, and open for allocation immediately`;
  }

  if (newStatus === 'upcoming') {
    return `${title} is now listed as Upcoming, and may be opening for allocation soon`;
  }

  return `${title} is now ${opportunityStatusLabel(newStatus)}.`;
}
