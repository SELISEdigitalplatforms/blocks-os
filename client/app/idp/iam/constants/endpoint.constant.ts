import { getRuntimeEnv } from "@/lib/runtime-env";

// ─── Subpaths ─────────────────────────────────────────────────────────────────
const BLOCKS_IDP_BASE_URL = getRuntimeEnv("BLOCKS_IDP_BASE_URL");
const IAM_SUBPATH = "/iam";
const IAM_CONFIG_SUBPATH = "/IAM";

// ─── User endpoints (user.service) ──────────────────────────────────────────

export const USER_ENDPOINTS = {
  GET_USERS: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/users`,
  GET_USER: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/user`,
  USER_INFO: `${BLOCKS_IDP_BASE_URL}/api/idp/UserInfo`,
  CREATE: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/Create`,
  UPDATE: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/Update`,
  GET_SIGNUP_SETTING: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/signup-settings`,
  SAVE_SIGNUP_SETTING: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/signup-settings`,
  SAVE_ROLES_AND_PERMISSIONS: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/roles-permissions`,


  GET_USER_ROLES: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/user/roles`,
  GET_USER_PERMISSIONS: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/user/permissions`,
  DEACTIVATE: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/users/deactivate`,
} as const;

// ─── Account endpoints (account.service) ────────────────────────────────────

export const ACCOUNT_ENDPOINTS = {
  ACTIVATE: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/Activate`,
  RESEND_ACTIVATION: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/ResendActivation`,
  RECOVER: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/Recover`,
  RESET_PASSWORD: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/ResetPassword`,
  VALIDATE_ACTIVATION_CODE: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/ValidateActivationCode`,
} as const;

// ─── Role endpoints (role.service) ──────────────────────────────────────────

export const ROLE_ENDPOINTS = {
  GET_ROLES: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/user/roles`,
  GET_ROLE: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/role`,
  CREATE_ROLE: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/roles/create`,
  UPDATE_ROLE: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/roles/update`,
  SET_ROLES: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/roles/assign`,
} as const;

// ─── Permission endpoints (permission.service) ─────────────────────────────

export const PERMISSION_ENDPOINTS = {
  GET_PERMISSIONS: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/permissions`,
  GET_PERMISSION: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/permission`,
  GET_PERMISSIONS_GROUP_BY_SEVERITY: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/permissions/by-severity`,
  CREATE_PERMISSION: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/permissions/create`,
  UPDATE_PERMISSION: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/permissions/update`,
  GET_RESOURCE_GROUPS: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/resource-groups`,
} as const;

// ─── Organization endpoints (organization.service) ─────────────────────────

export const ORGANIZATION_ENDPOINTS = {
  GET_ORGANIZATIONS: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/organizations`,
  GET_ORGANIZATION: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/organization`,
  SAVE_ORGANIZATION: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/organizations`,
  GET_ORGANIZATION_CONFIG: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/organization/config`,
  SAVE_ORGANIZATION_CONFIG: `${BLOCKS_IDP_BASE_URL}/api${IAM_SUBPATH}/organization/config`,
} as const;

// ─── IAM configuration endpoints (configuration.service) ───────────────────

export const IAM_CONFIGURATION_ENDPOINTS = {
  GET: `${BLOCKS_IDP_BASE_URL}/api${IAM_CONFIG_SUBPATH}/Get`,
  SAVE: `${BLOCKS_IDP_BASE_URL}/api${IAM_CONFIG_SUBPATH}/Save`,
} as const;
