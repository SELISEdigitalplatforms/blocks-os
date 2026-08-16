import { http } from "@/lib/http/http-client";
import type {
  BaseResponse,
  SecretAuditFilter,
  SecretAuditListResult,
  SecretFilter,
  SecretListResult,
  SecretResult,
  SecretValueResponse,
  SecretValuesResponse,
  SetManySecretsResponse,
  SetSecretRequest,
  SetSecretResponse,
  UpdateSecretRequest,
  SecretAccess,
} from "@/cross-modules/secrets/models/secret.model";

const BASE = "/api/secrets";

export const SECRET_ENDPOINTS = {
  SET: `${BASE}/set`,
  SET_MANY: `${BASE}/set-many`,
  GET: `${BASE}/get`,
  GETS: `${BASE}/gets`,
  VALUE: `${BASE}/value`,
  VALUES: `${BASE}/values`,
  UPDATE: `${BASE}/update`,
  ROTATE: `${BASE}/rotate`,
  LOCK: `${BASE}/lock`,
  UNLOCK: `${BASE}/unlock`,
  DELETE: `${BASE}/delete`,
  RESTORE: `${BASE}/restore`,
  ACCESS: `${BASE}/access`,
  AUDIT: `${BASE}/audit`,
} as const;

/**
 * Builds a query string from a filter, dropping empty values.
 *
 * "All" in the toolbar is the empty string, and sending `type=` would reach the backend as an
 * empty string rather than as "no filter" — `SecretFilter.Type` is nullable, so the key has to
 * be absent, not blank.
 */
const toQuery = (filter: object): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value === undefined || value === null || value === "") continue;
    params.append(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
};

export class SecretManagementService {
  /** Paged metadata list. Never carries values. */
  find(filter: SecretFilter = {}): Promise<SecretListResult> {
    return http.get<SecretListResult>(`${SECRET_ENDPOINTS.GETS}${toQuery(filter)}`);
  }

  /** Single secret by id. Rejects with a 404 when the id is not in the caller's tenant. */
  get(secretId: string): Promise<SecretResult> {
    return http.get<SecretResult>(`${SECRET_ENDPOINTS.GET}${toQuery({ secretId })}`);
  }

  /**
   * Reads a plaintext value. Audited server-side as `GetValue` on every call, so call it once
   * per deliberate user action — never speculatively on row expand.
   */
  getValue(secretId: string): Promise<SecretValueResponse> {
    return http.get<SecretValueResponse>(`${SECRET_ENDPOINTS.VALUE}${toQuery({ secretId })}`);
  }

  /** Batch value read. Capped server-side at 50 ids. */
  getValues(secretIds: string[]): Promise<SecretValuesResponse> {
    return http.post<SecretValuesResponse>(SECRET_ENDPOINTS.VALUES, { secretIds });
  }

  set(payload: SetSecretRequest): Promise<SetSecretResponse> {
    return http.post<SetSecretResponse>(SECRET_ENDPOINTS.SET, payload);
  }

  setMany(payloads: SetSecretRequest[]): Promise<SetManySecretsResponse> {
    return http.post<SetManySecretsResponse>(SECRET_ENDPOINTS.SET_MANY, payloads);
  }

  /** Metadata only — name and description. Access goes through {@link updateAccess}. */
  update(secretId: string, payload: UpdateSecretRequest): Promise<BaseResponse> {
    return http.post<BaseResponse>(SECRET_ENDPOINTS.UPDATE, { secretId, ...payload });
  }

  rotate(secretId: string, value: string): Promise<BaseResponse> {
    return http.post<BaseResponse>(SECRET_ENDPOINTS.ROTATE, { secretId, value });
  }

  lock(secretId: string): Promise<BaseResponse> {
    return http.post<BaseResponse>(SECRET_ENDPOINTS.LOCK, { secretId });
  }

  unlock(secretId: string): Promise<BaseResponse> {
    return http.post<BaseResponse>(SECRET_ENDPOINTS.UNLOCK, { secretId });
  }

  /** Soft delete — the value stays in the vault so {@link restore} can bring it back. */
  remove(secretId: string): Promise<BaseResponse> {
    return http.delete<BaseResponse>(`${SECRET_ENDPOINTS.DELETE}${toQuery({ secretId })}`);
  }

  restore(secretId: string): Promise<BaseResponse> {
    return http.post<BaseResponse>(SECRET_ENDPOINTS.RESTORE, { secretId });
  }

  /**
   * Replaces a secret's access list. Separately permissioned (`blocks-os::secret::access`), so
   * a caller who may edit metadata can still be refused here.
   */
  updateAccess(secretId: string, access: SecretAccess): Promise<BaseResponse> {
    return http.post<BaseResponse>(SECRET_ENDPOINTS.ACCESS, { secretId, access });
  }

  getAuditLogs(filter: SecretAuditFilter = {}): Promise<SecretAuditListResult> {
    return http.get<SecretAuditListResult>(`${SECRET_ENDPOINTS.AUDIT}${toQuery(filter)}`);
  }
}

export const secretManagementService = new SecretManagementService();
