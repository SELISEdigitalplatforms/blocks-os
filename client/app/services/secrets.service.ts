import { http } from "@/lib/http-client";
import type { SaveSecretRequest, SecretItem } from "@/cross-modules/secrets/constants/secret-key.enum";
import type { IAPIResponse } from "@/models/api-response";

const SECRETS_BASE = "/api/Secrets";

export const SECRETS_ENDPOINTS = {
  SAVE: `${SECRETS_BASE}/Save`,
  GETS: `${SECRETS_BASE}/Gets`,
  GET: `${SECRETS_BASE}/Get`,
    DELETE: `${SECRETS_BASE}/Delete`,

} as const;

export class SecretsService {
  save(payload: SaveSecretRequest): Promise<SecretItem> {
    return http.post(SECRETS_ENDPOINTS.SAVE, payload);
  }

  gets(secretKey: string): Promise<SecretItem[]> {
    return http
      .get<SecretItem[] | IAPIResponse<SecretItem[]>>(
        `${SECRETS_ENDPOINTS.GETS}?secretKey=${secretKey}&PageNumber=0&PageSize=10`,
      )
      .then((response) => (Array.isArray(response) ? response : (response.data ?? [])));
  }

  get(itemId: string): Promise<SecretItem> {
    return http.get(`${SECRETS_ENDPOINTS.GET}?ItemId=${itemId}`);
  }

  delete(itemId: string): Promise<void> {
    return http.post(SECRETS_ENDPOINTS.DELETE, { itemId });
  }
}

export const secretsService = new SecretsService();
