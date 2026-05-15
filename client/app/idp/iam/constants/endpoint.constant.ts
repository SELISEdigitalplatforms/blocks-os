// ─── Subpaths ─────────────────────────────────────────────────────────────────

const IAM_SUBPATH = "/iam";
const AUTH_SUBPATH = "/auth";
const IAM_CONFIG_SUBPATH = "/IAM";

// ─── User endpoints (user.service) ──────────────────────────────────────────

export const USER_ENDPOINTS = {
  GET_USERS: `/api${IAM_SUBPATH}/GetUsers`,
  GET_USER: `/api${IAM_SUBPATH}/user`,
  USER_INFO: `/api/idp/UserInfo`,
  CREATE: `/api${IAM_SUBPATH}/Create`,
  UPDATE: `/api${IAM_SUBPATH}/Update`,
  GET_SIGNUP_SETTING: `/api${IAM_SUBPATH}/GetSignUpSetting`,
  SAVE_SIGNUP_SETTING: `/api${IAM_SUBPATH}/SaveSignUpSetting`,
  SAVE_ROLES_AND_PERMISSIONS: `/api${IAM_SUBPATH}/SaveRolesAndPermissions`,
  GET_SESSIONS: `/api${IAM_SUBPATH}/GetSessions`,
  GET_HISTORIES: `/api${IAM_SUBPATH}/GetHistories`,
  GET_USER_CODES: `/api${AUTH_SUBPATH}/GetUserCodes`,
  GENERATE_USER_CODE: `/api${AUTH_SUBPATH}/GenerateUserCode`,
  GET_USER_ROLES: `/api${IAM_SUBPATH}/GetUserRoles`,
  GET_USER_PERMISSIONS: `/api${IAM_SUBPATH}/GetUserPermissions`,
  DEACTIVATE: `/api${IAM_SUBPATH}/Deactivate`,
} as const;

// ─── Account endpoints (account.service) ────────────────────────────────────

export const ACCOUNT_ENDPOINTS = {
  ACTIVATE: `/api${IAM_SUBPATH}/Activate`,
  RESEND_ACTIVATION: `/api${IAM_SUBPATH}/ResendActivation`,
  RECOVER: `/api${IAM_SUBPATH}/Recover`,
  RESET_PASSWORD: `/api${IAM_SUBPATH}/ResetPassword`,
  VALIDATE_ACTIVATION_CODE: `/api${IAM_SUBPATH}/ValidateActivationCode`,
} as const;

// ─── Role endpoints (role.service) ──────────────────────────────────────────

export const ROLE_ENDPOINTS = {
  GET_ROLES: `/api${IAM_SUBPATH}/user/roles`,
  GET_ROLE: `/api${IAM_SUBPATH}/role`,
  CREATE_ROLE: `/api${IAM_SUBPATH}/roles/create`,
  UPDATE_ROLE: `/api${IAM_SUBPATH}/roles/update`,
  SET_ROLES: `/api${IAM_SUBPATH}/roles/assign`,
} as const;

// ─── Permission endpoints (permission.service) ─────────────────────────────

export const PERMISSION_ENDPOINTS = {
  GET_PERMISSIONS: `/api${IAM_SUBPATH}/permissions`,
  GET_PERMISSION: `/api${IAM_SUBPATH}/permission`,
  GET_PERMISSIONS_GROUP_BY_SEVERITY: `/api${IAM_SUBPATH}/permissions/by-severity`,
  CREATE_PERMISSION: `/api${IAM_SUBPATH}/permissions/create`,
  UPDATE_PERMISSION: `/api${IAM_SUBPATH}/permissions/update`,
  GET_RESOURCE_GROUPS: `/api${IAM_SUBPATH}/resource-groups`,
} as const;

// ─── Organization endpoints (organization.service) ─────────────────────────

export const ORGANIZATION_ENDPOINTS = {
  GET_ORGANIZATIONS: `/api${IAM_SUBPATH}/organizations`,
  GET_ORGANIZATION: `/api${IAM_SUBPATH}/organization`,
  SAVE_ORGANIZATION: `/api${IAM_SUBPATH}/organizations`,
  GET_ORGANIZATION_CONFIG: `/api${IAM_SUBPATH}/organization/config`,
  SAVE_ORGANIZATION_CONFIG: `/api${IAM_SUBPATH}/organization/config`,
} as const;

// ─── IAM configuration endpoints (configuration.service) ───────────────────

export const IAM_CONFIGURATION_ENDPOINTS = {
  GET: `/api${IAM_CONFIG_SUBPATH}/Get`,
  SAVE: `/api${IAM_CONFIG_SUBPATH}/Save`,
} as const;
