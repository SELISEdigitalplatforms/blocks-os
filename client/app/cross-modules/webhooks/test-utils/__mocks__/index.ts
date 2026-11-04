import type { IWebhook, IWebhookDelivery } from "../../models/webhook.model";

export const SIGNING_SECRET = "s".repeat(32);

export const makeWebhook = (over: Partial<IWebhook> = {}): IWebhook => ({
  id: "wh-1",
  name: "CRM sync",
  url: "https://crm.acme.com/hooks/blocks",
  isActive: true,
  actions: ["iam.user.created", "iam.user.updated", "iam.user.activated"],
  secretSet: true,
  secretChangedDate: "2026-11-01T08:00:00Z",
  createdDate: "2026-10-30T08:00:00Z",
  createdBy: "usr_admin_07",
  consecutiveFailures: 0,
  disabledReason: null,
  ...over,
});

export const makeDelivery = (over: Partial<IWebhookDelivery> = {}): IWebhookDelivery => ({
  id: "dl-1",
  eventId: "evt_01A",
  action: "iam.user.created",
  webhookId: "wh-1",
  status: "Delivered",
  statusReason: null,
  body: '{"id":"evt_01A","action":"iam.user.created","data":{"userId":"u1"}}',
  traceId: null,
  createdDate: "2026-11-02T10:00:00Z",
  lastUpdatedDate: "2026-11-02T10:00:01Z",
  nextAttemptAt: null,
  attempts: [
    { no: 1, at: "2026-11-02T10:00:01Z", httpStatus: 200, durationMs: 120, errorCode: null },
  ],
  ...over,
});
