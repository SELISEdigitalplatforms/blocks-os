import { API_BASES } from "@/constants/endpoint.constant";

const SECURITY_SUBPATH = "/security";

export const SECURITY_ENDPOINTS = {
  SUMMARY: `${API_BASES.IAM}${SECURITY_SUBPATH}/summary`,
  SESSIONS: `${API_BASES.IAM}${SECURITY_SUBPATH}/sessions`,
  SESSION_DETAILS: `${API_BASES.IAM}${SECURITY_SUBPATH}/sessions/{sessionId}`,
  REVOKE_SESSION: `${API_BASES.IAM}${SECURITY_SUBPATH}/sessions/{sessionId}/revoke`,
  REVOKE_REFRESH_TOKEN: `${API_BASES.IAM}${SECURITY_SUBPATH}/revoke/refresh-tokens/{tokenId}`,
  ACTIVITY: `${API_BASES.IAM}${SECURITY_SUBPATH}/activity`,
  GET_USER_CODES: `${API_BASES.IAM}/auth/user-codes`,
  GENERATE_USER_CODE: `${API_BASES.IAM}/auth/user-codes`,
} as const;
