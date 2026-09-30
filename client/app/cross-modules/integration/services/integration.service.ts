import { http } from "@/lib/http/http-client";
import {
  IIntegrationTemplate,
  IIntegrationConnection, IRunIntegrationSetupPayload, IRunIntegrationSetupResponse,
} from "@/cross-modules/integration/models/integration.model";

const BASE = "/api/Integration";

export const INTEGRATION_ENDPOINTS = {
  GET_TEMPLATES: `${BASE}/GetTemplates`,
  GET_TEMPLATE: `${BASE}/GetTemplate`,
  GET_CONNECTIONS: `${BASE}/GetConnections`, RUN_SETUP: `${BASE}/RunSetup`, DISCONNECT: `${BASE}/Disconnect`, REGENERATE_SECRET: `${BASE}/RegenerateSecret`,
} as const;

export class IntegrationService {
  getTemplates(family?: string): Promise<IIntegrationTemplate[]> {
    const query = family ? `?family=${encodeURIComponent(family)}` : "";
    return http.get(`${INTEGRATION_ENDPOINTS.GET_TEMPLATES}${query}`);
  }

  getTemplate(key: string, includeInactive = false): Promise<IIntegrationTemplate | null> {
    const query = new URLSearchParams({ key, includeInactive: String(includeInactive) });
    return http.get(`${INTEGRATION_ENDPOINTS.GET_TEMPLATE}?${query.toString()}`);
  }

  getConnections(): Promise<{ data: IIntegrationConnection[]; errors?: Record<string, string> | null }> { return http.get(INTEGRATION_ENDPOINTS.GET_CONNECTIONS); }
  runSetup(payload: IRunIntegrationSetupPayload): Promise<IRunIntegrationSetupResponse> { return http.post(INTEGRATION_ENDPOINTS.RUN_SETUP, payload); }
  disconnect(connectionId: string): Promise<{ isSuccess: boolean; errors?: Record<string, string> | null }> { return http.post(INTEGRATION_ENDPOINTS.DISCONNECT, { connectionId }); }
  regenerateSecret(connectionId: string): Promise<{ isSuccess: boolean; clientSecret?: string; errors?: Record<string, string> | null }> { return http.post(INTEGRATION_ENDPOINTS.REGENERATE_SECRET, { connectionId }); }
}

export const integrationService = new IntegrationService();
