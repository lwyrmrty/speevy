/**
 * Slack admin notifications (optional).
 *
 * Required for any notification:
 *   SLACK_BOT_TOKEN          — Bot User OAuth Token (xoxb-…)
 *   SLACK_ADMIN_CHANNEL_ID   — Channel ID (C…) where alerts are posted
 *
 * Required for the interactive Approve button:
 *   SLACK_SIGNING_SECRET     — App → Basic Information → Signing Secret
 *   SLACK_ADMIN_USER_IDS     — Comma-separated Slack member IDs (U…) allowed to
 *                              click Approve (Harpoon admins in the workspace)
 *
 * Interactivity request URL (production):
 *   https://<your-app>/api/slack/interactions
 */

export function getSlackBotToken() {
  return process.env.SLACK_BOT_TOKEN?.trim() ?? '';
}

export function getSlackAdminChannelId() {
  return process.env.SLACK_ADMIN_CHANNEL_ID?.trim() ?? '';
}

export function getSlackSigningSecret() {
  return process.env.SLACK_SIGNING_SECRET?.trim() ?? '';
}

export function getSlackAdminUserIds(): Set<string> {
  const raw = process.env.SLACK_ADMIN_USER_IDS?.trim() ?? '';
  if (!raw) {
    return new Set();
  }

  return new Set(
    raw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

export function hasSlackNotificationsEnv() {
  return Boolean(getSlackBotToken() && getSlackAdminChannelId());
}

export function hasSlackInteractivityEnv() {
  return Boolean(
    getSlackBotToken()
      && getSlackSigningSecret()
      && getSlackAdminChannelId(),
  );
}
