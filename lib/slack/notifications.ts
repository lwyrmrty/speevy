import { postSlackMessage } from '@/lib/slack/client';
import { hasSlackNotificationsEnv } from '@/lib/slack/env';

export const SLACK_ACTION_APPROVE_LP = 'approve_lp_access_request';

function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://speevy.vc').replace(/\/$/, '');
}

function logSlackFailure(label: string, error: unknown) {
  console.error(
    `${label} failed:`,
    error instanceof Error ? error.message : error,
  );
}

export async function notifySlackLpAccessRequest(input: {
  lpId: string;
  investorName: string;
  investorEmail: string;
  companyName: string;
  sectors: string;
  investmentRange: string;
  submittedAt: string;
}): Promise<void> {
  if (!hasSlackNotificationsEnv()) {
    return;
  }

  const adminUrl = `${appBaseUrl()}/admin/investors`;
  const approveValue = JSON.stringify({ lpId: input.lpId });

  try {
    await postSlackMessage({
      text: `New investor access request: ${input.investorName} (${input.investorEmail})`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: 'New investor access request', emoji: true },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Name*\n${input.investorName}` },
            { type: 'mrkdwn', text: `*Email*\n${input.investorEmail}` },
            { type: 'mrkdwn', text: `*Company*\n${input.companyName}` },
            { type: 'mrkdwn', text: `*Sectors*\n${input.sectors}` },
            { type: 'mrkdwn', text: `*Investment range*\n${input.investmentRange}` },
            { type: 'mrkdwn', text: `*Submitted*\n${input.submittedAt}` },
          ],
        },
        {
          type: 'actions',
          block_id: `approve_lp_${input.lpId}`,
          elements: [
            {
              type: 'button',
              action_id: SLACK_ACTION_APPROVE_LP,
              text: { type: 'plain_text', text: 'Approve', emoji: true },
              style: 'primary',
              value: approveValue,
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Open in Speevy', emoji: true },
              url: adminUrl,
            },
          ],
        },
      ],
    });
  } catch (error) {
    logSlackFailure('Slack LP access request notification', error);
  }
}

export async function notifySlackInvestorJoined(input: {
  kind: 'insider' | 'outsider';
  investorName: string;
  investorEmail: string;
  companyName?: string | null;
  opportunityTitle?: string | null;
  joinedAt: string;
}): Promise<void> {
  if (!hasSlackNotificationsEnv()) {
    return;
  }

  const label = input.kind === 'outsider' ? 'Outsider joined' : 'Investor approved';
  const adminUrl = `${appBaseUrl()}/admin/investors`;
  const fields: Array<{ type: 'mrkdwn'; text: string }> = [
    { type: 'mrkdwn', text: `*Name*\n${input.investorName}` },
    { type: 'mrkdwn', text: `*Email*\n${input.investorEmail}` },
    { type: 'mrkdwn', text: `*Type*\n${input.kind === 'outsider' ? 'Outsider (password gate)' : 'Approved insider'}` },
    { type: 'mrkdwn', text: `*When*\n${input.joinedAt}` },
  ];

  if (input.companyName) {
    fields.push({ type: 'mrkdwn', text: `*Company*\n${input.companyName}` });
  }

  if (input.opportunityTitle) {
    fields.push({ type: 'mrkdwn', text: `*Opportunity*\n${input.opportunityTitle}` });
  }

  try {
    await postSlackMessage({
      text: `${label}: ${input.investorName} (${input.investorEmail})`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: label, emoji: true },
        },
        { type: 'section', fields },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Open in Speevy', emoji: true },
              url: adminUrl,
            },
          ],
        },
      ],
    });
  } catch (error) {
    logSlackFailure('Slack investor joined notification', error);
  }
}

export async function notifySlackOpportunityInterest(input: {
  investorName: string;
  investorEmail: string;
  opportunityTitle: string;
  opportunitySlug: string;
  amountLabel: string;
  indicatedAt: string;
  source: 'lp' | 'password_gate';
}): Promise<void> {
  if (!hasSlackNotificationsEnv()) {
    return;
  }

  const adminUrl = `${appBaseUrl()}/admin/opportunities/${input.opportunitySlug}/interest`;
  const opportunityUrl = `${appBaseUrl()}/opportunities/${input.opportunitySlug}`;
  const sourceLabel = input.source === 'password_gate' ? 'Outsider (password gate)' : 'Approved LP';

  try {
    await postSlackMessage({
      text: `New interest on ${input.opportunityTitle}: ${input.investorName}`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: 'New opportunity interest', emoji: true },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Opportunity*\n${input.opportunityTitle}` },
            { type: 'mrkdwn', text: `*Investor*\n${input.investorName}` },
            { type: 'mrkdwn', text: `*Email*\n${input.investorEmail}` },
            { type: 'mrkdwn', text: `*Amount*\n${input.amountLabel}` },
            { type: 'mrkdwn', text: `*Source*\n${sourceLabel}` },
            { type: 'mrkdwn', text: `*When*\n${input.indicatedAt}` },
          ],
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View interest', emoji: true },
              url: adminUrl,
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Open opportunity', emoji: true },
              url: opportunityUrl,
            },
          ],
        },
      ],
    });
  } catch (error) {
    logSlackFailure('Slack opportunity interest notification', error);
  }
}

export function buildApprovedAccessRequestBlocks(input: {
  investorName: string;
  investorEmail: string;
  companyName: string;
  approvedByLabel: string;
  approvedAt: string;
}) {
  const adminUrl = `${appBaseUrl()}/admin/investors`;

  return {
    text: `Approved: ${input.investorName} (${input.investorEmail})`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Investor access request approved', emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Name*\n${input.investorName}` },
          { type: 'mrkdwn', text: `*Email*\n${input.investorEmail}` },
          { type: 'mrkdwn', text: `*Company*\n${input.companyName}` },
          { type: 'mrkdwn', text: `*Approved by*\n${input.approvedByLabel}` },
          { type: 'mrkdwn', text: `*Approved at*\n${input.approvedAt}` },
        ],
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: 'This investor can now log in to Speevy.' },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Open in Speevy', emoji: true },
            url: adminUrl,
          },
        ],
      },
    ],
  };
}
