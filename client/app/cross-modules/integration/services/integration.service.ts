import { http } from "@/lib/http/http-client";
import {
  IIntegrationTemplate,
  IGetIntegrationSetupResponse,
  ISaveIntegrationSetupPayload,
  ISaveIntegrationSetupResponse,
} from "@/cross-modules/integration/models/integration.model";

const BASE = "/api/Integration";

export const INTEGRATION_ENDPOINTS = {
  GET_TEMPLATES: `${BASE}/GetTemplates`,
  GET_SETUP: `${BASE}/GetSetup`,
  SAVE_SETUP: `${BASE}/SaveSetup`,
} as const;

export class IntegrationService {
  getTemplates(): Promise<IIntegrationTemplate[]> {
    return http.get(INTEGRATION_ENDPOINTS.GET_TEMPLATES);
  }

  getSetup(): Promise<IGetIntegrationSetupResponse> {
    return http.get(INTEGRATION_ENDPOINTS.GET_SETUP);
  }

  saveSetup(payload: ISaveIntegrationSetupPayload): Promise<ISaveIntegrationSetupResponse> {
    return http.post(INTEGRATION_ENDPOINTS.SAVE_SETUP, payload);
  }
}

export const integrationService = new IntegrationService();
