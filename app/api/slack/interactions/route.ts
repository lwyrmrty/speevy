import { NextResponse } from 'next/server';
import { z } from 'zod';

import { approvePendingLp } from '@/lib/admin/approve-lp';
import { updateSlackMessage } from '@/lib/slack/client';
import { getSlackAdminUserIds, hasSlackInteractivityEnv } from '@/lib/slack/env';
import {
  buildApprovedAccessRequestBlocks,
  SLACK_ACTION_APPROVE_LP,
} from '@/lib/slack/notifications';
import { verifySlackRequestSignature } from '@/lib/slack/verify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const approveActionValueSchema = z.object({
  lpId: z.string().uuid(),
});

type SlackInteractionPayload = {
  type?: string;
  user?: { id?: string; username?: string; name?: string };
  channel?: { id?: string };
  message?: { ts?: string; blocks?: unknown[] };
  actions?: Array<{ action_id?: string; value?: string }>;
  response_url?: string;
};

function slackUserMayApprove(userId: string | undefined): boolean {
  if (!userId) {
    return false;
  }

  const allowed = getSlackAdminUserIds();
  if (allowed.size === 0) {
    return false;
  }

  return allowed.has(userId);
}

export async function POST(request: Request) {
  if (!hasSlackInteractivityEnv()) {
    return NextResponse.json({ error: 'Slack interactivity is not configured.' }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('x-slack-signature');
  const timestamp = request.headers.get('x-slack-request-timestamp');

  if (!verifySlackRequestSignature(rawBody, signature, timestamp)) {
    return NextResponse.json({ error: 'Invalid Slack signature.' }, { status: 401 });
  }

  const params = new URLSearchParams(rawBody);
  let payload: SlackInteractionPayload;

  try {
    payload = JSON.parse(params.get('payload') ?? '{}') as SlackInteractionPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid interaction payload.' }, { status: 400 });
  }

  if (payload.type !== 'block_actions') {
    return new NextResponse(null, { status: 200 });
  }

  const action = payload.actions?.[0];
  if (!action || action.action_id !== SLACK_ACTION_APPROVE_LP) {
    return new NextResponse(null, { status: 200 });
  }

  const slackUserId = payload.user?.id;
  if (!slackUserMayApprove(slackUserId)) {
    return NextResponse.json({
      response_type: 'ephemeral',
      replace_original: false,
      text: 'You are not authorized to approve investors in Slack. Ask an admin to add your Slack member ID to SLACK_ADMIN_USER_IDS.',
    });
  }

  const parsedValue = (() => {
    try {
      return approveActionValueSchema.safeParse(
        JSON.parse(action.value ?? '{}') as unknown,
      );
    } catch {
      return { success: false as const, error: null };
    }
  })();

  if (!parsedValue.success) {
    return NextResponse.json({
      response_type: 'ephemeral',
      replace_original: false,
      text: 'This approve action is invalid or expired. Open Speevy to approve manually.',
    });
  }

  const result = await approvePendingLp(parsedValue.data.lpId, {
    approvedByProfileId: null,
    source: 'slack',
    slackUserId,
  });

  const approverLabel = payload.user?.username
    ? `@${payload.user.username}`
    : payload.user?.name ?? 'Slack admin';

  if (!result.ok) {
    return NextResponse.json({
      response_type: 'ephemeral',
      replace_original: false,
      text: result.message,
    });
  }

  const updated = buildApprovedAccessRequestBlocks({
    investorName: result.investor.fullName,
    investorEmail: result.investor.email,
    companyName: result.investor.companyName,
    approvedByLabel: approverLabel,
    approvedAt: result.approvedAt,
  });

  const channelId = payload.channel?.id;
  const messageTs = payload.message?.ts;

  if (channelId && messageTs) {
    try {
      await updateSlackMessage({
        channel: channelId,
        ts: messageTs,
        text: updated.text,
        blocks: updated.blocks,
      });
    } catch (error) {
      console.error(
        'Slack message update after approve failed:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  return NextResponse.json({
    replace_original: true,
    ...updated,
  });
}
