import { http } from "@/lib/http/http-client";
import type { IAPIResponse } from "@/models/api-response";
import { NOTIFICATION_ENDPOINTS } from "../constants/endpoint.constant";
import {
  IGetNotificationConfigsPayload,
  IGetNotificationConfigsResponse,
  INotificationConfigRow,
  ISaveNotificationConfigPayload,
  ISaveNotificationConfigResponse,
} from "../models/notification-config.model";

export interface INotificationGetsApiResponse {
  errors?: Record<string, string> | null;
  isSuccess?: boolean;
  totalCount?: number;
  configurations?: INotificationConfigRow[];
}

export interface INotificationSaveApiResponse {
  errors?: Record<string, string> | null;
  isSuccess?: boolean;
}

export interface INotificationDeleteApiResponse {
  errors?: Record<string, string> | null;
  isSuccess?: boolean;
}

const filterBySearch = (
  configs: INotificationConfigRow[],
  searchText?: string,
): INotificationConfigRow[] => {
  const query = searchText?.trim().toLowerCase();
  if (!query) return configs;
  return configs.filter(
    (config) =>
      config.name.toLowerCase().includes(query) ||
      config.notifyMethod.toLowerCase().includes(query),
  );
};

/** The list endpoint answers either wrapped in `data` or as the bare response. */
const toConfigsResponse = (
  response: INotificationGetsApiResponse | IAPIResponse<INotificationGetsApiResponse>,
): INotificationGetsApiResponse => {
  const wrapped = (response as IAPIResponse<INotificationGetsApiResponse>).data;
  if (Array.isArray(wrapped)) return wrapped;
  const bare = response as INotificationGetsApiResponse;
  if (bare.configurations !== undefined) return bare;
  return { configurations: [], totalCount: 0 };
};

const BUILT_IN_FIELD_KEYS = [
  "isBuiltIn",
  "isDisabled",
  "description",
  "importance",
  "kind",
  "sourceService",
  "consumerAppRecommendation",
  "consumerAppNote",
] as const;

/** Only fields the caller set are sent, so an unchanged config keeps the old payload shape. */
const pickBuiltInFields = (payload: ISaveNotificationConfigPayload) => {
  const picked: Partial<Record<(typeof BUILT_IN_FIELD_KEYS)[number], unknown>> = {};
  for (const key of BUILT_IN_FIELD_KEYS) {
    if (payload[key] !== undefined) picked[key] = payload[key];
  }
  return picked;
};

const DELIVERY_FIELD_KEYS = [
  "scope",
  "audience",
  "liveEnabled",
  "pushEnabled",
  "pushTemplate",
  "pushPlatforms",
  "pushOptions",
  "rateLimitPerMinute",
  "defaultAudience",
  "audienceLocked",
] as const;

/** Same rule as the built-in fields: a field the caller did not set is not sent. */
const pickDeliveryFields = (payload: ISaveNotificationConfigPayload) => {
  const picked: Partial<Record<(typeof DELIVERY_FIELD_KEYS)[number], unknown>> = {};
  for (const key of DELIVERY_FIELD_KEYS) {
    if (payload[key] !== undefined) picked[key] = payload[key];
  }
  return picked;
};

export class NotificationConfigService {
  getNotificationConfigs(
    payload: IGetNotificationConfigsPayload,
  ): Promise<IGetNotificationConfigsResponse> {
    const params = new URLSearchParams({
      page: payload.page.toString(),
      pageSize: payload.pageSize.toString(),
      projectKey: payload.projectKey,
    });
    if (payload.searchText?.trim()) {
      params.append("SearchText", payload.searchText.trim());
    }

    return http
      .get<INotificationGetsApiResponse | IAPIResponse<INotificationGetsApiResponse>>(
        `${NOTIFICATION_ENDPOINTS.GET_CONFIGS}?${params.toString()}`,
      )
      .then((response) => {
        const data = toConfigsResponse(response);

        const configurations = data.configurations ?? [];
        const filtered = filterBySearch(configurations, payload.searchText);

        return {
          configurations: filtered,
          totalCount: data.totalCount ?? filtered.length,
        };
      });
  }

  saveNotificationConfig(
    payload: ISaveNotificationConfigPayload,
  ): Promise<ISaveNotificationConfigResponse> {
    return http
      .post<INotificationSaveApiResponse>(NOTIFICATION_ENDPOINTS.SAVE_CONFIG, {
        name: payload.name,
        channelToNotify: payload.channelToNotify,
        notificationType: payload.notificationType,
        enablePersistence: payload.enablePersistence,
        notifyMethod: payload.notifyMethod,
        itemId: payload.itemId ?? "",
        isUpdateRequest: !!payload.itemId,
        ...pickBuiltInFields(payload),
        ...pickDeliveryFields(payload),
      })
      .then((response): ISaveNotificationConfigResponse => ({
        isSuccess: !!response?.isSuccess,
        errors: response?.errors ?? null,
        itemId: payload.itemId ?? "",
      }));
  }

  deleteNotificationConfig(itemId: string): Promise<void> {
    return http
      .delete<INotificationDeleteApiResponse>(
        `${NOTIFICATION_ENDPOINTS.DELETE_CONFIG}?itemId=${encodeURIComponent(itemId)}`,
      )
      .then((response) => {
        // A refusal (for example a built-in config deleted by a non-root user) can arrive as a 200.
        if (response?.isSuccess === false) {
          throw Object.assign(new Error("Delete failed"), {
            errors: response.errors ?? { itemId: "Delete failed" },
          });
        }
      });
  }

  getNotificationConfig(itemId: string): Promise<INotificationConfigRow> {
    return http
      .get<INotificationConfigRow | IAPIResponse<INotificationConfigRow>>(
        `${NOTIFICATION_ENDPOINTS.GET_CONFIG}?itemId=${encodeURIComponent(itemId)}`,
      )
      .then((response) =>
        (response as IAPIResponse<INotificationConfigRow>).data
          ? (response as IAPIResponse<INotificationConfigRow>).data
          : (response as INotificationConfigRow),
      );
  }
}

export const notificationConfigService = new NotificationConfigService();
