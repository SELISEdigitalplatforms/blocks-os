import { http } from "@/lib/http/http-client";
import { secretsService, SECRETS_ENDPOINTS } from "@/services/secrets.service";
import type { SecretItem } from "@/cross-modules/secrets/constants/secret-key.enum";
import type { IAPIResponse } from "@/models/api-response";
import {
  IGetMagicUrlConfigsPayload,
  IGetMagicUrlConfigsResponse,
  IMagicUrlConfig,
  ISaveMagicUrlConfigPayload,
  ISaveMagicUrlConfigResponse,
  MAGIC_URL_CONFIG_SECRET_KEY,
} from "@blocks-utilities/models/magic-url-config.model";

const mapSecretToConfig = (secret: SecretItem): IMagicUrlConfig => {
  const kv = secret.keyValuePairs;
  return {
    itemId: secret.itemId,
    createdDate: secret.createdDate,
    lastUpdatedDate: secret.lastUpdatedDate,
    createdBy: secret.createdBy,
    lastUpdatedBy: secret.lastUpdatedBy,
    organizationIds: secret.organizationIds,
    tags: secret.tags,
    contextName: kv.contextName ?? "",
    shortUrlBase: kv.shortUrlBase ?? "",
  };
};

const normalizeSecretsResponse = (
  response: SecretItem[] | IAPIResponse<SecretItem[]>,
): SecretItem[] => {
  if (Array.isArray(response)) return response;
  return response.data ?? [];
};

const filterBySearch = (configs: IMagicUrlConfig[], searchText?: string): IMagicUrlConfig[] => {
  const query = searchText?.trim().toLowerCase();
  if (!query) return configs;
  return configs.filter(
    (config) =>
      config.contextName.toLowerCase().includes(query) ||
      config.shortUrlBase.toLowerCase().includes(query),
  );
};

export class MagicUrlConfigService {
  getMagicUrlConfigs(payload: IGetMagicUrlConfigsPayload): Promise<IGetMagicUrlConfigsResponse> {
    const params = new URLSearchParams({
      secretKey: MAGIC_URL_CONFIG_SECRET_KEY,
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

  saveMagicUrlConfig(payload: ISaveMagicUrlConfigPayload): Promise<ISaveMagicUrlConfigResponse> {
    return secretsService
      .save({
        secretKey: MAGIC_URL_CONFIG_SECRET_KEY,
        keyValuePairs: {
          contextName: payload.contextName,
          shortUrlBase: payload.shortUrlBase,
        },
        ...(payload.itemId ? { itemId: payload.itemId } : {}),
      })
      .then((item) => ({ isSuccess: true, errors: null, itemId: item.itemId }));
  }

  deleteMagicUrlConfig(itemId: string): Promise<void> {
    return secretsService.delete(itemId);
  }
}

export const magicUrlConfigService = new MagicUrlConfigService();
