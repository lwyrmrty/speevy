import { getAppUrl } from '@/lib/app-url';
import {
  buildOpportunityFillSummary,
  formatCompactUsdFromCents,
  formatWholeUsdFromCents,
} from '@/lib/opportunity-interest-summary';
import {
  getZapierLpAccessRequestWebhookUrl,
  getZapierOpportunityInterestWebhookUrl,
  hasZapierLpAccessRequestWebhookEnv,
  hasZapierOpportunityInterestWebhookEnv,
} from '@/lib/zapier/env';
import { postZapierCatchHook } from '@/lib/zapier/webhook';

function logZapierFailure(label: string, error: unknown) {
  console.error(
    `${label} failed:`,
    error instanceof Error ? error.message : error,
  );
}

export async function notifyZapierLpAccessRequest(input: {
  lpId: string;
  investorName: string;
  investorEmail: string;
  companyName: string;
  sectors: string;
  investmentRange: string;
  submittedAt: string;
}): Promise<void> {
  if (!hasZapierLpAccessRequestWebhookEnv()) {
    return;
  }

  const adminInvestorsUrl = `${getAppUrl()}/admin/investors`;

  try {
    await postZapierCatchHook(getZapierLpAccessRequestWebhookUrl(), {
      event: 'lp_access_request',
      lp_id: input.lpId,
      investor_name: input.investorName,
      investor_email: input.investorEmail,
      company_name: input.companyName,
      sectors: input.sectors,
      investment_range: input.investmentRange,
      submitted_at: input.submittedAt,
      admin_investors_url: adminInvestorsUrl,
    });
  } catch (error) {
    logZapierFailure('Zapier LP access request notification', error);
  }
}

export async function notifyZapierOpportunityInterest(input: {
  investorName: string;
  investorEmail: string;
  opportunityTitle: string;
  opportunitySlug: string;
  amountLabel: string;
  indicatedAt: string;
  source: 'lp' | 'password_gate';
  isUpdate: boolean;
  investorCount: number;
  totalInterestCents: number;
  targetAllocationCents: number | null;
}): Promise<void> {
  if (!hasZapierOpportunityInterestWebhookEnv()) {
    return;
  }

  const adminInterestUrl = `${getAppUrl()}/admin/opportunities/${input.opportunitySlug}/interest`;
  const opportunityUrl = `${getAppUrl()}/opportunities/${input.opportunitySlug}`;
  const sourceLabel = input.source === 'password_gate' ? 'Outsider (password gate)' : 'Approved LP';
  const fillSummary = buildOpportunityFillSummary(
    input.totalInterestCents,
    input.targetAllocationCents,
  );
  const fillPercent = input.targetAllocationCents && input.targetAllocationCents > 0
    ? Math.round((input.totalInterestCents / input.targetAllocationCents) * 100)
    : null;

  try {
    await postZapierCatchHook(getZapierOpportunityInterestWebhookUrl(), {
      event: 'opportunity_interest',
      interest_kind: input.isUpdate ? 'updated' : 'new',
      investor_name: input.investorName,
      investor_email: input.investorEmail,
      opportunity_title: input.opportunityTitle,
      opportunity_slug: input.opportunitySlug,
      amount: input.amountLabel,
      source: sourceLabel,
      indicated_at: input.indicatedAt,
      admin_interest_url: adminInterestUrl,
      opportunity_url: opportunityUrl,
      investor_count: input.investorCount,
      total_interest_cents: input.totalInterestCents,
      total_interest_label: formatWholeUsdFromCents(input.totalInterestCents),
      total_interest_compact: formatCompactUsdFromCents(input.totalInterestCents),
      target_allocation_cents: input.targetAllocationCents,
      target_allocation_label: input.targetAllocationCents
        ? formatWholeUsdFromCents(input.targetAllocationCents)
        : null,
      target_allocation_compact: input.targetAllocationCents
        ? formatCompactUsdFromCents(input.targetAllocationCents)
        : null,
      fill_summary: fillSummary,
      fill_percent: fillPercent,
    });
  } catch (error) {
    logZapierFailure('Zapier opportunity interest notification', error);
  }
}
