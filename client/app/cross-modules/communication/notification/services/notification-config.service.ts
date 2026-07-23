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
      .get<
        | INotificationGetsApiResponse
        | IAPIResponse<INotificationGetsApiResponse>
      >(`${NOTIFICATION_ENDPOINTS.GET_CONFIGS}?${params.toString()}`)
      .then((response) => {
        const data: INotificationGetsApiResponse = Array.isArray(
          (response as IAPIResponse<INotificationGetsApiResponse>).data,
        )
          ? (response as IAPIResponse<INotificationGetsApiResponse>).data
          : (response as INotificationGetsApiResponse).configurations !==
              undefined
            ? (response as INotificationGetsApiResponse)
            : { configurations: [], totalCount: 0 };

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
      })
      .then(
        (response): ISaveNotificationConfigResponse => ({
          isSuccess: !!response?.isSuccess,
          errors: response?.errors ?? null,
          itemId: payload.itemId ?? "",
        }),
      );
  }

  deleteNotificationConfig(itemId: string): Promise<void> {
    return http
      .delete<INotificationDeleteApiResponse>(
        `${NOTIFICATION_ENDPOINTS.DELETE_CONFIG}?itemId=${encodeURIComponent(itemId)}`,
      )
      .then(() => undefined);
  }

  getNotificationConfig(itemId: string): Promise<INotificationConfigRow> {
    return http
      .get<
        INotificationConfigRow | IAPIResponse<INotificationConfigRow>
      >(`${NOTIFICATION_ENDPOINTS.GET_CONFIG}?itemId=${encodeURIComponent(itemId)}`)
      .then((response) =>
        (response as IAPIResponse<INotificationConfigRow>).data
          ? (response as IAPIResponse<INotificationConfigRow>).data
          : (response as INotificationConfigRow),
      );
  }
}

export const notificationConfigService = new NotificationConfigService();
