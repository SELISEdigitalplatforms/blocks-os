import { http } from "@/lib/http/http-client";
import {
  IConnectTemplate,
  IGetConnectSetupResponse,
  ISaveConnectSetupPayload,
  ISaveConnectSetupResponse,
} from "@/cross-modules/connect/models/connect.model";

const BASE = "/api/Connect";

export const CONNECT_ENDPOINTS = {
  GET_TEMPLATES: `${BASE}/GetTemplates`,
  GET_SETUP: `${BASE}/GetSetup`,
  SAVE_SETUP: `${BASE}/SaveSetup`,
} as const;

export class ConnectService {
  getTemplates(): Promise<IConnectTemplate[]> {
    return http.get(CONNECT_ENDPOINTS.GET_TEMPLATES);
  }

  getSetup(): Promise<IGetConnectSetupResponse> {
    return http.get(CONNECT_ENDPOINTS.GET_SETUP);
  }

  saveSetup(payload: ISaveConnectSetupPayload): Promise<ISaveConnectSetupResponse> {
    return http.post(CONNECT_ENDPOINTS.SAVE_SETUP, payload);
  }
}

export const connectService = new ConnectService();
