import { http } from "@/lib/http-client";
import { secretsService, SECRETS_ENDPOINTS } from "@/services/secrets.service";
import type { SecretItem } from "@/cross-modules/secrets/constants/secret-key.enum";
import type { IAPIResponse } from "@/models/api-response";
import {
  IGetNotificationConfigsPayload,
  IGetNotificationConfigsResponse,
  INotificationConfigRow,
  ISaveNotificationConfigPayload,
  ISaveNotificationConfigResponse,
  NOTIFICATION_CONFIG_SECRET_KEY,
} from "../models/notification-config.model";

const parseNumber = (value: string | undefined, fallback = 0): number => {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const parseBoolean = (value: string | undefined): boolean => {
  if (value === undefined) return false;
  return value === "true" || value === "1";
};

const mapSecretToConfig = (secret: SecretItem): INotificationConfigRow => {
  const kv = secret.keyValuePairs;
  return {
    itemId: secret.itemId,
    createdDate: secret.createdDate,
    lastUpdatedDate: secret.lastUpdatedDate,
    createdBy: secret.createdBy,
    lastUpdatedBy: secret.lastUpdatedBy,
    name: kv.name ?? "",
    channelToNotify: parseNumber(kv.channelToNotify),
    notificationType: parseNumber(kv.notificationType),
    enablePersistence: parseBoolean(kv.enablePersistence),
    notifyMethod: kv.notifyMethod ?? "",
  };
};

const normalizeSecretsResponse = (
  response: SecretItem[] | IAPIResponse<SecretItem[]>,
): SecretItem[] => {
  if (Array.isArray(response)) return response;
  return response.data ?? [];
};

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
      secretKey: NOTIFICATION_CONFIG_SECRET_KEY,
      PageSize: payload.pageSize.toString(),
      PageNumber: payload.page.toString(),
    });
    if (payload.searchText?.trim()) {
      params.append("SearchText", payload.searchText.trim());
    }

    return http
      .get<SecretItem[] | IAPIResponse<SecretItem[]>>(
        `${SECRETS_ENDPOINTS.GETS}?${params.toString()}`,
      )
      .then((response) => {
        const secrets = normalizeSecretsResponse(response);
        const mapped = secrets.map(mapSecretToConfig);
        const filtered = filterBySearch(mapped, payload.searchText);
        const totalCount = Array.isArray(response)
          ? filtered.length
          : (response.totalCount ?? filtered.length);

        return {
          configurations: filtered,
          totalCount,
        };
      });
  }

  saveNotificationConfig(
    payload: ISaveNotificationConfigPayload,
  ): Promise<ISaveNotificationConfigResponse> {
    return secretsService
      .save({
        secretKey: NOTIFICATION_CONFIG_SECRET_KEY,
        keyValuePairs: {
          name: payload.name,
          channelToNotify: String(payload.channelToNotify),
          notificationType: String(payload.notificationType),
          enablePersistence: String(payload.enablePersistence),
          notifyMethod: payload.notifyMethod,
        },
        ...(payload.itemId ? { itemId: payload.itemId } : {}),
      })
      .then((item) => ({ isSuccess: true, errors: null, itemId: item.itemId }));
  }

  deleteNotificationConfig(itemId: string): Promise<void> {
    return secretsService.delete(itemId);
  }
}

export const notificationConfigService = new NotificationConfigService();
