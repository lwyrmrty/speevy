import { getSlackAdminChannelId, getSlackBotToken, hasSlackNotificationsEnv } from '@/lib/slack/env';

type SlackBlock = Record<string, unknown>;

type PostMessageInput = {
  text: string;
  blocks?: SlackBlock[];
  channel?: string;
};

type SlackApiResponse = {
  ok: boolean;
  error?: string;
  ts?: string;
  channel?: string;
};

async function slackApi<T extends SlackApiResponse>(
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const token = getSlackBotToken();
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as T;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error ?? `Slack API ${method} failed (${response.status}).`);
  }

  return payload;
}

export async function postSlackMessage({
  text,
  blocks,
  channel,
}: PostMessageInput): Promise<{ ts: string; channel: string } | null> {
  if (!hasSlackNotificationsEnv()) {
    return null;
  }

  const payload = await slackApi<SlackApiResponse>('chat.postMessage', {
    channel: channel ?? getSlackAdminChannelId(),
    text,
    blocks,
    unfurl_links: false,
    unfurl_media: false,
  });

  if (!payload.ts || !payload.channel) {
    return null;
  }

  return { ts: payload.ts, channel: payload.channel };
}

export async function updateSlackMessage({
  channel,
  ts,
  text,
  blocks,
}: {
  channel: string;
  ts: string;
  text: string;
  blocks?: SlackBlock[];
}): Promise<void> {
  if (!hasSlackNotificationsEnv()) {
    return;
  }

  await slackApi<SlackApiResponse>('chat.update', {
    channel,
    ts,
    text,
    blocks,
  });
}
