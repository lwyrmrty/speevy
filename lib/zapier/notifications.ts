import {
  getZapierLpAccessRequestWebhookUrl,
  getZapierOpportunityInterestWebhookUrl,
  hasZapierLpAccessRequestWebhookEnv,
  hasZapierOpportunityInterestWebhookEnv,
} from '@/lib/zapier/env';
import { postZapierCatchHook } from '@/lib/zapier/webhook';

function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://speevy.vc').replace(/\/$/, '');
}

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

  const adminInvestorsUrl = `${appBaseUrl()}/admin/investors`;

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
}): Promise<void> {
  if (!hasZapierOpportunityInterestWebhookEnv()) {
    return;
  }

  const adminInterestUrl = `${appBaseUrl()}/admin/opportunities/${input.opportunitySlug}/interest`;
  const opportunityUrl = `${appBaseUrl()}/opportunities/${input.opportunitySlug}`;
  const sourceLabel = input.source === 'password_gate' ? 'Outsider (password gate)' : 'Approved LP';

  try {
    await postZapierCatchHook(getZapierOpportunityInterestWebhookUrl(), {
      event: 'opportunity_interest',
      investor_name: input.investorName,
      investor_email: input.investorEmail,
      opportunity_title: input.opportunityTitle,
      opportunity_slug: input.opportunitySlug,
      amount: input.amountLabel,
      source: sourceLabel,
      indicated_at: input.indicatedAt,
      admin_interest_url: adminInterestUrl,
      opportunity_url: opportunityUrl,
    });
  } catch (error) {
    logZapierFailure('Zapier opportunity interest notification', error);
  }
}
