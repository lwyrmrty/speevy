async function postZapierWebhook(
  webhookUrl: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Zapier webhook failed (${response.status}).`);
  }
}

export async function postZapierCatchHook(
  webhookUrl: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!webhookUrl) {
    return;
  }

  await postZapierWebhook(webhookUrl, payload);
}
