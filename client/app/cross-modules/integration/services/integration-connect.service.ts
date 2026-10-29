import { http } from "@/lib/http/http-client";

const BASE = "/api/Integration";

export const INTEGRATION_CONNECT_ENDPOINTS = {
  CREATE_REQUEST: `${BASE}/CreateRequest`,
  GET_REQUEST: `${BASE}/GetRequest`,
  CANCEL: `${BASE}/Cancel`,
  APPROVE: `${BASE}/Approve`,
  CHECK_READINESS: `${BASE}/CheckReadiness`,
} as const;

export interface ICreateConnectRequestPayload {
  family: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  siteName: string;
  suggestedTemplateKey?: string;
}

export interface IConnectRequestView {
  requestId: string;
  siteName: string;
  redirectHost: string;
  family: string;
  templates: {
    key: string;
    displayName: string;
    description?: string | null;
    accessLevel: string;
    permissionCount: number;
  }[];
  suggestedTemplateKey?: string | null;
  status: string;
  expiresAt: string;
}

export class IntegrationConnectService {
  createRequest(payload: ICreateConnectRequestPayload): Promise<{ requestId: string; expiresAt: string }> {
    return http.post(INTEGRATION_CONNECT_ENDPOINTS.CREATE_REQUEST, payload);
  }

  getRequest(requestId: string): Promise<IConnectRequestView> {
    return http.get(`${INTEGRATION_CONNECT_ENDPOINTS.GET_REQUEST}?requestId=${encodeURIComponent(requestId)}`);
  }

  cancel(requestId: string): Promise<{ redirectUrl: string }> {
    return http.post(INTEGRATION_CONNECT_ENDPOINTS.CANCEL, { requestId });
  }

  approve(requestId: string, templateKey: string): Promise<{ redirectUrl: string }> {
    return http.post(INTEGRATION_CONNECT_ENDPOINTS.APPROVE, { requestId, templateKey });
  }

  checkReadiness(templateKey: string): Promise<{ ready: boolean; missingPermissions: string[]; error?: string }> {
    return http.get(`${INTEGRATION_CONNECT_ENDPOINTS.CHECK_READINESS}?templateKey=${encodeURIComponent(templateKey)}`);
  }
}

export const integrationConnectService = new IntegrationConnectService();
