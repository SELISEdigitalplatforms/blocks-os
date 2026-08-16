import { http } from "@/lib/http/http-client";
import type { IAPIResponse } from "@/models/api-response";

/**
 * ⚠️ DEAD INTERIM SHIM — every endpoint below has been removed from the backend.
 *
 * `/api/Secrets/{Save,Gets,Get,Delete}` no longer exist. The secret store was rewritten: values
 * live in Azure Key Vault and the API is now `/api/secrets/*` with one opaque value per secret
 * (see `cross-modules/secrets/services/secret-management.service.ts`).
 *
 * Two consumers still import this file and are therefore **broken at runtime today**,
 * independently of the secret-management page:
 *
 *   - `cross-modules/idp/captcha/services/captcha.service.ts`
 *   - `cross-modules/utilities/services/magic-url-config.service.ts`
 *
 * Neither can be ported as-is: they use this store as a *structured config store*, reading named
 * fields out of `keyValuePairs`, and the new model stores a single opaque string per secret.
 * Migrating them (own config collections / JSON-in-a-secret / one secret per field) is a
 * separate ticket — tracked as F-16 in BLOCKS-SECRETS-FE-TECH-SPEC.md §2.1 — and it is blocked
 * on that decision.
 *
 * This file exists only to keep those two modules compiling until that lands. Do not add
 * callers, and do not treat it as a working API.
 */

const SECRETS_BASE = "/api/Secrets";

export const SECRETS_ENDPOINTS = {
  SAVE: `${SECRETS_BASE}/Save`,
  GETS: `${SECRETS_BASE}/Gets`,
  GET: `${SECRETS_BASE}/Get`,
  DELETE: `${SECRETS_BASE}/Delete`,
} as const;

/** @deprecated Shape of the removed key-value secret store. See the file header. */
export interface SaveSecretRequest {
  secretKey: string;
  keyValuePairs: Record<string, unknown>;
  projectKey?: string;
  itemId?: string;
}

/** @deprecated Shape of the removed key-value secret store. See the file header. */
export interface SecretItem {
  itemId: string;
  secretKey: string;
  keyValuePairs: Record<string, string>;
  createdDate?: string;
  lastUpdatedDate?: string;
  createdBy?: string;
  lastUpdatedBy?: string;
  organizationIds?: string[];
  tags?: string[];
  language?: string | null;
}

/** @deprecated Calls endpoints that no longer exist. See the file header. */
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
