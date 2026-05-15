// ─── Subpaths ─────────────────────────────────────────────────────────────────

const AUTH_SUBPATH = "/auth";
const AUTH_OIDC_SUBPATH = "/oidc";

// ─── Auth endpoints (auth.service) ───────────────────────────────────────────

export const AUTH_ENDPOINTS = {
  TOKEN: `/api${AUTH_SUBPATH}/Token`,
  USER_INFO: `/api/idp/UserInfo`,
  LOGOUT: `/api${AUTH_SUBPATH}/Logout`,
} as const;

// ─── Client credential endpoints (auth-clients.service) ─────────────────────

export const AUTH_CLIENT_ENDPOINTS = {
  GET_CLIENT_CREDENTIALS: `/api${AUTH_SUBPATH}/GetClientCredentials`,
  SAVE_CLIENT_CREDENTIAL: `/api${AUTH_SUBPATH}/SaveClientCredential`,
  DELETE_CLIENT_CREDENTIAL: `/api${AUTH_SUBPATH}/DeleteClientCredential`,
} as const;

// ─── OIDC client endpoints (auth-clients-oidc.service) ──────────────────────

export const AUTH_OIDC_ENDPOINTS = {
  GET_OIDC_CLIENTS: `/api${AUTH_SUBPATH}/GetOIDCClients`,
  GET_OIDC_CLIENT: `/api${AUTH_SUBPATH}/GetOIDCClient`,
  SAVE_OIDC_CLIENT: `/api${AUTH_SUBPATH}/SaveOIDCClient`,
  DELETE_OIDC_CLIENT: `/api${AUTH_SUBPATH}/DeleteOIDCClient`,
  OIDC_TOKEN: `/api${AUTH_OIDC_SUBPATH}/token`,
} as const;

// ─── Auth configuration endpoints (auth-config.service) ─────────────────────

export const AUTH_CONFIG_ENDPOINTS = {
  GET_CONFIG: `/api${AUTH_SUBPATH}/Get`,
  UPDATE_CONFIG: `/api${AUTH_SUBPATH}/Update`,
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
  IMPERSONATE: `/api${AUTH_SUBPATH}/impersonate`,
  STOP_IMPERSONATION: `/api${AUTH_SUBPATH}/impersonation/stop`,
} as const;
