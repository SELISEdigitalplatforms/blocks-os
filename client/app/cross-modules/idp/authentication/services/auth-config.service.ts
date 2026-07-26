import { http } from "@/lib/http/http-client";
import {
  IAuthConfigPayload,
  IGetAuthConfigResponse,
  ISaveAuthConfigPayload,
  ISaveAuthConfigResponse,
} from "@blocks-idp/authentication/models/auth-configuration.model";
import { AUTH_CONFIG_ENDPOINTS } from "../constants/endpoint.constant";

export class AuthConfiguration {
  getConfig(payload?: IAuthConfigPayload): Promise<IGetAuthConfigResponse> {
    const url = payload?.projectKey
      ? `${AUTH_CONFIG_ENDPOINTS.GET_CONFIG}?ProjectKey=${payload.projectKey}`
      : AUTH_CONFIG_ENDPOINTS.GET_CONFIG;

    return http.get(url, undefined, { absoluteUrl: true });
  }

  saveAuthConfig(payload: ISaveAuthConfigPayload): Promise<ISaveAuthConfigResponse> {
    return http.post(AUTH_CONFIG_ENDPOINTS.UPDATE_CONFIG, payload, undefined, {
      absoluteUrl: true,
    });
  }
}
