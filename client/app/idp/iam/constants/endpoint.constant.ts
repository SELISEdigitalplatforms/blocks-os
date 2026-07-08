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

  GET_USER_ROLES: `${API_BASES.IAM}${IAM_SUBPATH}/user/roles`,
  GET_USER_PERMISSIONS: `${API_BASES.IAM}${IAM_SUBPATH}/user/permissions`,
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
  GET_USER_CODES: `${API_BASES.IAM}/auth/GetUserCodes`,
  GENERATE_USER_CODE: `${API_BASES.IAM}/auth/GenerateUserCode`,

} as const;

// ─── Account endpoints (account.service) ────────────────────────────────────

export const ACCOUNT_ENDPOINTS = {
  ACTIVATE: `${API_BASES.IAM}${IAM_SUBPATH}/Activate`,
  RESEND_ACTIVATION: `${API_BASES.IAM}/auth/resend-activation`,
  RECOVER: `${API_BASES.IAM}${IAM_SUBPATH}/Recover`,
  RESET_PASSWORD: `${API_BASES.IAM}${IAM_SUBPATH}/ResetPassword`,
  VALIDATE_ACTIVATION_CODE: `${API_BASES.IAM}${IAM_SUBPATH}/ValidateActivationCode`,
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
  GET_PERMISSION: `${API_BASES.IAM}${IAM_SUBPATH}/permission`,
  GET_PERMISSIONS_GROUP_BY_SEVERITY: `${API_BASES.IAM}${IAM_SUBPATH}/permissions/by-severity`,
  CREATE_PERMISSION: `${API_BASES.IAM}${IAM_SUBPATH}/permissions/create`,
  UPDATE_PERMISSION: `${API_BASES.IAM}${IAM_SUBPATH}/permissions/update`,
  GET_RESOURCE_GROUPS: `${API_BASES.IAM}${IAM_SUBPATH}/resource-groups`,
} as const;

// ─── Organization endpoints (organization.service) ─────────────────────────

export const ORGANIZATION_ENDPOINTS = {
  CREATE_ORGANIZATION: `${API_BASES.IAM}${IAM_SUBPATH}/organizations/create`,
  GET_ORGANIZATIONS: `${API_BASES.IAM}${IAM_SUBPATH}/organizations`,
  GET_ORGANIZATION: `${API_BASES.IAM}${IAM_SUBPATH}/organization`,
  SAVE_ORGANIZATION: `${API_BASES.IAM}${IAM_SUBPATH}/organizations`,
  GET_ORGANIZATION_CONFIG: `${API_BASES.IAM}${IAM_SUBPATH}/organizations/config`,
  SAVE_ORGANIZATION_CONFIG: `${API_BASES.IAM}${IAM_SUBPATH}/organizations/config`,
} as const;

// ─── IAM configuration endpoints (configuration.service) ───────────────────

export const IAM_CONFIGURATION_ENDPOINTS = {
  GET: `${API_BASES.IAM}${IAM_SUBPATH}/config`,
  SAVE: `${API_BASES.IAM}${IAM_SUBPATH}/config`,
} as const;
