/**
 * Client-side contract for the secret store (`/api/secrets`).
 *
 * Values live in Azure Key Vault; Mongo holds metadata and an audit trail. No type in this
 * file carries a plaintext value except {@link SecretValueResponse}, which is only ever
 * produced by the dedicated, audited value endpoints.
 */

// ─── Wire enums ───────────────────────────────────────────────────────────────
// The backend constants are lowercase and compared with StringComparison.Ordinal, so a
// capitalised `"Api"` is rejected with 400 INVALID_TYPE. Send these values verbatim and use
// the label maps below for anything a person reads.

export const SECRET_TYPE = {
  Api: "api",
  Service: "service",
} as const;

export const SECRET_STATUS = {
  Active: "active",
  Locked: "locked",
  Deleted: "deleted",
} as const;

export type SecretType = (typeof SECRET_TYPE)[keyof typeof SECRET_TYPE];
export type SecretStatus = (typeof SECRET_STATUS)[keyof typeof SECRET_STATUS];

export const SECRET_TYPE_LABEL: Record<SecretType, string> = {
  api: "API",
  service: "Service",
};

export const SECRET_STATUS_LABEL: Record<SecretStatus, string> = {
  active: "Active",
  locked: "Locked",
  deleted: "Deleted",
};

/** Toolbar options. `""` is "All" — an empty filter value is omitted from the query. */
export const SECRET_TYPE_OPTIONS = [
  { value: "", label: "All" },
  { value: SECRET_TYPE.Api, label: SECRET_TYPE_LABEL.api },
  { value: SECRET_TYPE.Service, label: SECRET_TYPE_LABEL.service },
] as const;

export const SECRET_STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: SECRET_STATUS.Active, label: SECRET_STATUS_LABEL.active },
  { value: SECRET_STATUS.Locked, label: SECRET_STATUS_LABEL.locked },
  { value: SECRET_STATUS.Deleted, label: SECRET_STATUS_LABEL.deleted },
] as const;

// ─── Resources ────────────────────────────────────────────────────────────────

export interface SecretAccess {
  userIds: string[];
  roles: string[];
}

export interface SecretResult {
  secretId: string;
  name: string;
  description?: string | null;
  type: SecretType;
  status: SecretStatus;
  organizationId: string;
  /** Null for service secrets — they have no per-user access list. */
  access?: SecretAccess | null;
  createdDate: string;
  createdBy?: string | null;
  lastUpdatedDate: string;
  lastUpdatedBy?: string | null;
  lastRotatedDate?: string | null;
  lastRotatedBy?: string | null;
  rotationCount: number;
  deletedDate?: string | null;
  deletedBy?: string | null;

  /**
   * Backend-evaluated: whether THIS caller may read THIS secret's value, access list and
   * status already accounted for. Drive Reveal/Copy off this rather than re-deriving the rule
   * client-side, which would drift from `SecretAuthorizationService`.
   */
  canReadValue: boolean;
}

export interface SecretListResult {
  data: SecretResult[];
  totalCount: number;
}

export interface SecretValueResponse {
  secretId: string;
  value: string;
}

export interface SecretValuesResponse {
  values: Record<string, string>;
}

export interface SetSecretResponse {
  secretId: string;
}

export interface SetManySecretsResponse {
  /** name -> secretId */
  secretIds: Record<string, string>;
}

export interface BaseResponse {
  isSuccess: boolean;
  errors?: Record<string, string> | null;
}

// ─── Requests ─────────────────────────────────────────────────────────────────

export interface SetSecretRequest {
  name: string;
  description?: string;
  value: string;
  type: SecretType;
  /** Must be null/omitted for service secrets; the backend drops it either way. */
  access?: SecretAccess | null;
  /** Omit — defaults to the caller's organization. */
  organizationId?: string;
}

/**
 * Metadata only. Access changes go to a separate, separately-permissioned endpoint
 * (`POST /api/secrets/access`), and there is no `status` field — lifecycle moves through
 * lock/unlock/delete/restore.
 */
export interface UpdateSecretRequest {
  name?: string;
  description?: string;
}

export interface SecretFilter {
  search?: string;
  type?: SecretType;
  status?: SecretStatus;
  includeDeleted?: boolean;
  organizationId?: string;
  /** 1-based. */
  pageNumber?: number;
  /** Clamped server-side to 1..100. */
  pageSize?: number;
}

export interface SecretAuditFilter {
  secretId?: string;
  action?: string;
  actorUserId?: string;
  fromDate?: string;
  toDate?: string;
  /** 1-based. */
  pageNumber?: number;
  pageSize?: number;
}

export interface SecretAuditLogResult {
  auditId: string;
  secretId?: string | null;
  secretName?: string | null;
  /** One of SECRET_AUDIT_ACTIONS. */
  action: string;
  /** One of SECRET_AUDIT_OUTCOMES. */
  outcome: string;
  reason?: string | null;
  actorUserId: string;
  actorRoles: string[];
  isRootOverride: boolean;
  impersonated: boolean;
  requestUri?: string | null;
  traceId?: string | null;
  affectedCount?: number | null;
  createdDate: string;
}

export interface SecretAuditListResult {
  data: SecretAuditLogResult[];
  totalCount: number;
}

// ─── Audit vocabulary ─────────────────────────────────────────────────────────
// Mirrors SecretAuditActions / SecretAuditOutcomes on the server.

export const SECRET_AUDIT_OUTCOME = {
  Success: "Success",
  Denied: "Denied",
  Failed: "Failed",
  PartialFailure: "PartialFailure",
} as const;

export type SecretAuditOutcome = (typeof SECRET_AUDIT_OUTCOME)[keyof typeof SECRET_AUDIT_OUTCOME];

/** Human-readable labels for the reason codes the API returns in audit rows and errors. */
export const SECRET_AUDIT_REASON_LABEL: Record<string, string> = {
  NO_CONTEXT: "No authenticated context",
  INVALID_CONTEXT: "Invalid context",
  NOT_IN_ACCESS_LIST: "Not in the access list",
  STATUS_LOCKED: "Secret is locked",
  STATUS_DELETED: "Secret is deleted",
  VALUE_MISSING: "Value missing from the store",
  VAULT_FAILURE: "Secret store failure",
  METADATA_WRITE_FAILED: "Metadata write failed",
  CLEANUP_FAILED: "Cleanup failed",
  ACCESS_NOT_APPLICABLE: "Access list not applicable",
};

// ─── Validation, mirrored from the backend ────────────────────────────────────
// Kept in sync with SecretService.Helpers.cs and SecretDefaults so the user sees the error
// before a round trip. The server re-validates regardless.

export const SECRET_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
export const SECRET_NAME_MAX_LENGTH = 100;
export const SECRET_DESCRIPTION_MAX_LENGTH = 1000;
/** Azure Key Vault caps values at 25 KB. Measured in UTF-8 bytes, not characters. */
export const SECRET_VALUE_MAX_BYTES = 25 * 1024;

/** Backend validation reason codes, surfaced in `errors.reason` on a 400. */
export const SECRET_ERROR_REASON = {
  NameRequired: "NAME_REQUIRED",
  NameTooLong: "NAME_TOO_LONG",
  NameInvalid: "NAME_INVALID",
  NameTaken: "NAME_TAKEN",
  DescriptionTooLong: "DESCRIPTION_TOO_LONG",
  ValueRequired: "VALUE_REQUIRED",
  ValueTooLarge: "VALUE_TOO_LARGE",
  InvalidType: "INVALID_TYPE",
  BatchTooLarge: "BATCH_TOO_LARGE",
  DuplicateNameInBatch: "DUPLICATE_NAME_IN_BATCH",
} as const;

/**
 * UTF-8 byte length of a candidate secret value. Key Vault's limit is on the encoded payload,
 * so a `.length` check would let multi-byte values through and fail at the vault instead.
 */
export const secretValueByteLength = (value: string): number =>
  new TextEncoder().encode(value).length;

/**
 * `SecretFilter.Search` matches name and description only, so a pasted secret id finds
 * nothing. Ids are `Guid.ToString("N")` — 32 lowercase hex characters — which is
 * distinguishable enough from a name to route to a direct `get` instead.
 */
export const looksLikeSecretId = (query: string): boolean => /^[0-9a-f]{32}$/i.test(query.trim());

// ─── Display helpers ──────────────────────────────────────────────────────────

export const isApiSecret = (secret: Pick<SecretResult, "type">): boolean =>
  secret.type === SECRET_TYPE.Api;

export const isDeleted = (secret: Pick<SecretResult, "status">): boolean =>
  secret.status === SECRET_STATUS.Deleted;

/**
 * Whether the UI should offer a Reveal/Copy affordance at all.
 *
 * Service secrets hide it because a person has no reason to read a backend credential from
 * this screen — NOT because the backend refuses. `CheckValueRead` lets any authenticated
 * caller in the tenant read a `service` value, and the `::get-value` endpoint permission is
 * not type-aware. This is a UX choice, so nothing in the UI should present it as a guarantee.
 */
export const supportsValueReveal = (secret: Pick<SecretResult, "type">): boolean =>
  secret.type === SECRET_TYPE.Api;
