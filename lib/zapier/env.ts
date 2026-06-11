/**
 * Zapier Catch Hook URLs for admin notifications (optional).
 *
 * Create a Zap: Webhooks by Zapier (Catch Hook) → Slack (or other action).
 * Each event type uses its own webhook URL so Zaps can route independently.
 *
 *   ZAPIER_LP_ACCESS_REQUEST_WEBHOOK_URL   — investor join form submitted (pending review)
 *   ZAPIER_OPPORTUNITY_INTEREST_WEBHOOK_URL  — LP indicated interest on an opportunity
 */

export function getZapierLpAccessRequestWebhookUrl() {
  return process.env.ZAPIER_LP_ACCESS_REQUEST_WEBHOOK_URL?.trim() ?? '';
}

export function getZapierOpportunityInterestWebhookUrl() {
  return process.env.ZAPIER_OPPORTUNITY_INTEREST_WEBHOOK_URL?.trim() ?? '';
}

export function hasZapierLpAccessRequestWebhookEnv() {
  return Boolean(getZapierLpAccessRequestWebhookUrl());
}

export function hasZapierOpportunityInterestWebhookEnv() {
  return Boolean(getZapierOpportunityInterestWebhookUrl());
}
