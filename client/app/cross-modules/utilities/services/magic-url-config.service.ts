import { http } from "@/lib/http-client";
import { secretsService, SECRETS_ENDPOINTS } from "@/services/secrets.service";
import type { SecretItem } from "@/cross-modules/secrets/constants/secret-key.enum";
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

export class MagicUrlConfigService {
  getMagicUrlConfigs(
    _payload: IGetMagicUrlConfigsPayload,
  ): Promise<IGetMagicUrlConfigsResponse> {
    return http
      .get<SecretItem[]>(
        `${SECRETS_ENDPOINTS.GETS}?secretKey=${MAGIC_URL_CONFIG_SECRET_KEY}`,
      )
      .then((secrets) => {
        if (!secrets?.length) return { configurations: [] };
        return {
          configurations: secrets.map(mapSecretToConfig),
        };
      });
  }

  saveMagicUrlConfig(
    payload: ISaveMagicUrlConfigPayload,
  ): Promise<ISaveMagicUrlConfigResponse> {
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
