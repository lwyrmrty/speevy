const opportunityStatusLabels = {
  draft: 'Draft',
  potential: 'Potential',
  coming_soon: 'Coming Soon',
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
