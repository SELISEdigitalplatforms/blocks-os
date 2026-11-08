import type { IWebhook } from "../models/webhook.model";

/** True when the text is empty or is part of the webhook's name, URL or one of its action names. */
export const webhookMatchesSearch = (webhook: IWebhook, search: string): boolean => {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [webhook.name, webhook.url, ...webhook.actions].some((text) =>
    text.toLowerCase().includes(needle),
  );
};

export const filterWebhooks = (webhooks: IWebhook[], search: string): IWebhook[] =>
  webhooks.filter((webhook) => webhookMatchesSearch(webhook, search));
