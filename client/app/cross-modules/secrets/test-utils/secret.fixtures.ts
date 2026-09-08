import {
  SECRET_STATUS,
  SECRET_TYPE,
  type SecretAuditLogResult,
  type SecretResult,
} from "@/cross-modules/secrets/models/secret.model";

/** Guid.ToString("N") shape — 32 lowercase hex characters, as the backend generates. */
export const SECRET_ID = "0123456789abcdef0123456789abcdef";

export const makeSecret = (overrides: Partial<SecretResult> = {}): SecretResult => ({
  secretId: SECRET_ID,
  name: "payment-gateway-key",
  description: "Used by the checkout service",
  tags: [],
  type: SECRET_TYPE.Api,
  status: SECRET_STATUS.Active,
  organizationId: "default",
  access: { userIds: [], roles: [] },
  createdDate: "2026-01-15T10:00:00Z",
  createdBy: "user-1",
  lastUpdatedDate: "2026-02-01T09:30:00Z",
  lastUpdatedBy: "user-1",
  lastRotatedDate: null,
  lastRotatedBy: null,
  rotationCount: 0,
  deletedDate: null,
  deletedBy: null,
  canReadValue: true,
  ...overrides,
});

export const makeAuditLog = (
  overrides: Partial<SecretAuditLogResult> = {},
): SecretAuditLogResult => ({
  auditId: "audit-1",
  secretId: SECRET_ID,
  secretName: "payment-gateway-key",
  action: "GetValue",
  outcome: "Success",
  reason: null,
  actorUserId: "user-1",
  actorRoles: ["admin"],
  isRootOverride: false,
  impersonated: false,
  requestUri: null,
  traceId: null,
  affectedCount: null,
  createdDate: "2026-02-01T09:30:00Z",
  ...overrides,
});

/** Mirrors the `BaseResponse` body the API returns at a failure status. */
export class FakeHttpError extends Error {
  status: number;
  errors: Record<string, string>;

  constructor(status: number, errors: Record<string, string> = {}) {
    super(`HTTP ${status}`);
    this.status = status;
    this.errors = errors;
  }
}
