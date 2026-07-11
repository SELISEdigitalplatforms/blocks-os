import { API_BASES } from "@/constants/endpoint.constant";

// ─── Subpaths ─────────────────────────────────────────────────────────────────
const AUTH_SUBPATH = "/auth";
const AUTH_OIDC_SUBPATH = "oidc";

// ─── Auth endpoints (auth.service) ───────────────────────────────────────────

export const AUTH_ENDPOINTS = {
  TOKEN: `/api${AUTH_SUBPATH}/Token`,
  USER_INFO: `/api/idp/UserInfo`,
  LOGOUT: `${API_BASES.IAM}${AUTH_SUBPATH}/Logout`,
} as const;

// ─── Client credential endpoints (auth-clients.service) ─────────────────────

export const AUTH_CLIENT_ENDPOINTS = {
  LIST: `${API_BASES.IAM}${AUTH_SUBPATH}/client-credentials`,
  SAVE: `${API_BASES.IAM}${AUTH_SUBPATH}/client-credentials`,
  DELETE: `${API_BASES.IAM}${AUTH_SUBPATH}/client-credentials`,
} as const;

// ─── OIDC client endpoints (auth-clients-oidc.service) ──────────────────────

export const AUTH_OIDC_ENDPOINTS = {
  GET_OIDC_CLIENTS: `${API_BASES.IAM}/oidc-clients`,
  GET_OIDC_CLIENT: `${API_BASES.IAM}/oidc-clients`,
  SAVE_OIDC_CLIENT: `${API_BASES.IAM}/oidc-clients`,
  DELETE_OIDC_CLIENT: `${API_BASES.IAM}/oidc-clients`,
  ROTATE_OIDC_CLIENT_SECRET: `${API_BASES.IAM}/oidc-clients`,
  OIDC_TOKEN: `${API_BASES.IAM}/${AUTH_OIDC_SUBPATH}/token`,
  OIDC_CALL_BACK: `${API_BASES.IAM}/${AUTH_OIDC_SUBPATH}/oidc/callback`,
} as const;

// ─── Auth configuration endpoints (auth-config.service) ─────────────────────

export const AUTH_CONFIG_ENDPOINTS = {
  GET_CONFIG: `${API_BASES.IAM}${AUTH_SUBPATH}/config`,
  UPDATE_CONFIG: `${API_BASES.IAM}${AUTH_SUBPATH}/config`,
} as const;

// ─── SSO endpoints (social.service) ─────────────────────────────────────────

export const SSO_ENDPOINTS = {
  GET_SSO_CREDENTIALS: `/api${AUTH_SUBPATH}/GetSsoCredentials`,
  GET_SSO_CREDENTIAL: `/api${AUTH_SUBPATH}/GetSsoCredential`,
  SAVE_SSO_CREDENTIAL: `/api${AUTH_SUBPATH}/SaveSsoCredential`,
  DELETE_SSO_CREDENTIAL: `/api${AUTH_SUBPATH}/DeleteSsoCredential`,
  UPDATE_STATUS: `/api${AUTH_SUBPATH}/UpdateStatus`,
} as const;

// ─── OIDC flow endpoints (oidc-auth-flow.service) ───────────────────────────

export const OIDC_FLOW_ENDPOINTS = {
  USER_ACKNOWLEDGEMENT: `/api${AUTH_SUBPATH}/UserAcknowledgement`,
} as const;

export const IMPERSONATE_ENDPOINTS = {
  IMPERSONATE: `${API_BASES.IAM}${AUTH_SUBPATH}/impersonate`,
  STOP_IMPERSONATION: `${API_BASES.IAM}${AUTH_SUBPATH}/impersonation/stop`,
  IMPERSONATION_STATUS: `${API_BASES.IAM}${AUTH_SUBPATH}/impersonation/status`,
} as const;

// ─── Identity Provider endpoints (identity-provider.service) ─────────────────

export const IDENTITY_PROVIDER_ENDPOINTS = {
  GET_ALL: `${API_BASES.IAM}${AUTH_SUBPATH}/identity-providers`,
  GET_BY_ID: `${API_BASES.IAM}${AUTH_SUBPATH}/identity-providers`,
  CREATE: `${API_BASES.IAM}${AUTH_SUBPATH}/identity-providers`,
  UPDATE: `${API_BASES.IAM}${AUTH_SUBPATH}/identity-providers`,
  UPDATE_STATUS: `${API_BASES.IAM}${AUTH_SUBPATH}/identity-providers`,
  DELETE: `${API_BASES.IAM}${AUTH_SUBPATH}/identity-providers`,
} as const;

export const EXECUTION_CONTEXT_ENDPOINTS = {
  CONTEXT: `${API_BASES.IAM}${AUTH_SUBPATH}/context`,
};
