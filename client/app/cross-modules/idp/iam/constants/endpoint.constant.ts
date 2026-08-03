import { API_BASES } from "@/constants/endpoint.constant";

// ─── Subpaths ─────────────────────────────────────────────────────────────────
const IAM_SUBPATH = "/iam";

// ─── User endpoints (user.service) ──────────────────────────────────────────

export const USER_ENDPOINTS = {
  GET_USERS: `${API_BASES.IAM}${IAM_SUBPATH}/users`,
  ME: `${API_BASES.IAM}${IAM_SUBPATH}/me`,
  USER_INFO: `${API_BASES.IAM}/idp/UserInfo`,
  CREATE: `${API_BASES.IAM}${IAM_SUBPATH}/users/create`,
  UPDATE: `${API_BASES.IAM}${IAM_SUBPATH}/users/update`,
  GET_SIGNUP_SETTING: `${API_BASES.IAM}${IAM_SUBPATH}/signup-settings`,
  SAVE_SIGNUP_SETTING: `${API_BASES.IAM}${IAM_SUBPATH}/signup-settings`,
  SAVE_ROLES_AND_PERMISSIONS: `${API_BASES.IAM}${IAM_SUBPATH}/roles-permissions`,

  UPDATE_ME: `${API_BASES.IAM}${IAM_SUBPATH}/me`,
  ACCESS_CONTROL: `${API_BASES.IAM}${IAM_SUBPATH}/users/access`,
  REVOKE_ACCESS: `${API_BASES.IAM}${IAM_SUBPATH}/users/revoke-access`,
  EXISTS: `${API_BASES.IAM}${IAM_SUBPATH}/users/exists`,

  // A user's roles and permissions are resolved through ROLE_ENDPOINTS.GET_ROLES
  // and PERMISSION_ENDPOINTS.GET_PERMISSIONS; there is no /user/* lookup.
  GET_USER_TIMELINES: `${API_BASES.IAM}${IAM_SUBPATH}/user/timelines`,
  DEACTIVATE: `${API_BASES.IAM}${IAM_SUBPATH}/users/deactivate`,
  UPDATE_ACCOUNT: `${API_BASES.IAM}${IAM_SUBPATH}/account/update`,
  GET_ACCOUNTS: `${API_BASES.IAM}${IAM_SUBPATH}/accounts`,
  GET_ACCOUNT: `${API_BASES.IAM}${IAM_SUBPATH}/account`,
  GET_ACCOUNT_ROLES: `${API_BASES.IAM}${IAM_SUBPATH}/account/roles`,
  GET_ACCOUNT_PERMISSIONS: `${API_BASES.IAM}${IAM_SUBPATH}/account/permissions`,
  GET_EMAIL_AVAILABLE: `${API_BASES.IAM}${IAM_SUBPATH}/email/available`,

  GET_SESSIONS: `${API_BASES.IAM}${IAM_SUBPATH}/sessions`,
  GET_HISTORIES: `${API_BASES.IAM}${IAM_SUBPATH}/history`,
  // Personal access tokens live under /auth/user-codes (GET lists, POST issues).
  // The old /auth/PascalCase pair does not exist and falls through to the IAM
  // SPA, so the client got an HTML document back instead of JSON.
  GET_USER_CODES: `${API_BASES.IAM}/auth/user-codes`,
  GENERATE_USER_CODE: `${API_BASES.IAM}/auth/user-codes`,
} as const;

// ─── Account endpoints (account.service) ────────────────────────────────────

export const ACCOUNT_ENDPOINTS = {
  // IAM serves these account actions under /auth (kebab-case). The old /iam/PascalCase paths
  // no longer exist and return 405.
  ACTIVATE: `${API_BASES.IAM}/auth/activate`,
  RESEND_ACTIVATION: `${API_BASES.IAM}/auth/resend-activation`,
  RECOVER: `${API_BASES.IAM}/auth/recover`,
  RESET_PASSWORD: `${API_BASES.IAM}/auth/reset-password`,
  VALIDATE_ACTIVATION_CODE: `${API_BASES.IAM}/auth/validate-activation`,
} as const;

// ─── Role endpoints (role.service) ──────────────────────────────────────────

export const ROLE_ENDPOINTS = {
  GET_ROLES: `${API_BASES.IAM}${IAM_SUBPATH}/roles`,
  GET_ROLE: `${API_BASES.IAM}${IAM_SUBPATH}/role`,
  CREATE_ROLE: `${API_BASES.IAM}${IAM_SUBPATH}/roles/create`,
  UPDATE_ROLE: `${API_BASES.IAM}${IAM_SUBPATH}/roles/update`,
  SET_ROLES: `${API_BASES.IAM}${IAM_SUBPATH}/roles/assign-permissions`,
  GET_ALL_ASSIGNED_ROLES: `${API_BASES.IAM}${IAM_SUBPATH}/roles/assignable`,
} as const;

// ─── Permission endpoints (permission.service) ─────────────────────────────

export const PERMISSION_ENDPOINTS = {
  GET_PERMISSIONS: `${API_BASES.IAM}${IAM_SUBPATH}/permissions`,
  GET_PERMISSIONS_GROUP_BY_SEVERITY: `${API_BASES.IAM}${IAM_SUBPATH}/permissions/by-severity`,
  CREATE_PERMISSION: `${API_BASES.IAM}${IAM_SUBPATH}/permissions/create`,
  GET_RESOURCE_GROUPS: `${API_BASES.IAM}${IAM_SUBPATH}/resource-groups`,
} as const;

// ─── Organization endpoints (organization.service) ─────────────────────────

export const ORGANIZATION_ENDPOINTS = {
  CREATE_ORGANIZATION: `${API_BASES.IAM}${IAM_SUBPATH}/organizations/create`,
  GET_ORGANIZATIONS: `${API_BASES.IAM}${IAM_SUBPATH}/organizations`,
  // Single organization is a path segment on the collection, not a singular
  // resource: GET /organizations/{id}. The singular /organization path does not
  // exist and falls through to the IAM SPA.
  GET_ORGANIZATION: `${API_BASES.IAM}${IAM_SUBPATH}/organizations`,
  // Base path for the update route, POST /organizations/{id}.
  SAVE_ORGANIZATION: `${API_BASES.IAM}${IAM_SUBPATH}/organizations`,
  GET_ORGANIZATION_CONFIG: `${API_BASES.IAM}${IAM_SUBPATH}/organizations/config`,
  SAVE_ORGANIZATION_CONFIG: `${API_BASES.IAM}${IAM_SUBPATH}/organizations/config`,
} as const;

// ─── IAM configuration endpoints (configuration.service) ───────────────────

export const IAM_CONFIGURATION_ENDPOINTS = {
  GET: `${API_BASES.IAM}${IAM_SUBPATH}/config`,
  SAVE: `${API_BASES.IAM}${IAM_SUBPATH}/config`,
} as const;
