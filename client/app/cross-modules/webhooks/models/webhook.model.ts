/** A webhook as the API returns it. It never carries the secret, only whether one is set. */
export interface IWebhook {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
  actions: string[];
  secretSet: boolean;
  secretChangedDate: string | null;
  createdDate: string;
  createdBy: string | null;
  consecutiveFailures: number;
  disabledReason: string | null;
}

export interface ISaveWebhookPayload {
  id?: string;
  name: string;
  url: string;
  /** Required on create. On edit, empty keeps the current secret. */
  secret?: string;
  isActive: boolean;
  actions: string[];
}

export interface IWebhookTestResult {
  delivered: boolean;
  httpStatus: number | null;
  durationMs: number;
  errorCode: string | null;
}

export const DELIVERY_STATUSES = ["Pending", "Retrying", "Delivered", "Failed", "Skipped"] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export interface IWebhookAttempt {
  no: number;
  at: string;
  httpStatus: number | null;
  durationMs: number;
  errorCode: string | null;
}

export interface IWebhookDelivery {
  id: string;
  eventId: string;
  action: string;
  webhookId: string;
  status: DeliveryStatus;
  statusReason: string | null;
  body: string;
  traceId: string | null;
  createdDate: string;
  lastUpdatedDate: string;
  nextAttemptAt: string | null;
  attempts: IWebhookAttempt[];
}

export interface IWebhookDeliveryPage {
  totalCount: number;
  items: IWebhookDelivery[];
}

export interface IDeliveriesQuery {
  webhookId: string;
  status?: DeliveryStatus;
  action?: string;
  /** 1-based, as the server expects. */
  page: number;
  pageSize: number;
}
