import { http } from "@/lib/http/http-client";
import { WEBHOOKS_ENDPOINTS } from "../constants/endpoint.constant";
import type {
  IDeliveriesQuery,
  ISaveWebhookPayload,
  IWebhook,
  IWebhookDeliveryPage,
  IWebhookTestResult,
} from "../models/webhook.model";

const toQueryString = (query: IDeliveriesQuery): string => {
  const params = new URLSearchParams({
    webhookId: query.webhookId,
    page: String(query.page),
    pageSize: String(query.pageSize),
  });
  if (query.status) params.set("status", query.status);
  if (query.action) params.set("action", query.action);
  return params.toString();
};

export class WebhooksService {
  gets(): Promise<IWebhook[]> {
    return http.get<IWebhook[]>(WEBHOOKS_ENDPOINTS.GETS);
  }

  get(id: string): Promise<IWebhook> {
    return http.get<IWebhook>(`${WEBHOOKS_ENDPOINTS.GET}?id=${encodeURIComponent(id)}`);
  }

  save(payload: ISaveWebhookPayload): Promise<IWebhook> {
    return http.post<IWebhook>(WEBHOOKS_ENDPOINTS.SAVE, payload);
  }

  delete(id: string): Promise<boolean> {
    return http.post<boolean>(WEBHOOKS_ENDPOINTS.DELETE, { id });
  }

  test(id: string): Promise<IWebhookTestResult> {
    return http.post<IWebhookTestResult>(WEBHOOKS_ENDPOINTS.TEST, { id });
  }

  deliveries(query: IDeliveriesQuery): Promise<IWebhookDeliveryPage> {
    return http.get<IWebhookDeliveryPage>(
      `${WEBHOOKS_ENDPOINTS.DELIVERIES}?${toQueryString(query)}`,
    );
  }

  resend(deliveryId: string): Promise<boolean> {
    return http.post<boolean>(WEBHOOKS_ENDPOINTS.RESEND, { deliveryId });
  }
}

export const webhooksService = new WebhooksService();
