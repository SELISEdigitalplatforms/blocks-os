import { http } from "@/lib/http/http-client";
import { APIResponse } from "@/models/api-response";
import {
  IClientCredentialsConfig,
  IGetClientsPayload,
  ISaveClientCredentialPayload,
  ISaveClientCredentialResponse,
  IRotateClientCredentialSecretResponse,
} from "@blocks-idp/authentication/models/auth.oidc.model";
import { AUTH_CLIENT_ENDPOINTS } from "../constants/endpoint.constant";

export class AuthClientsService {
  list(_payload: IGetClientsPayload): Promise<IClientCredentialsConfig[]> {
    return http.get(AUTH_CLIENT_ENDPOINTS.LIST, undefined, {
      absoluteUrl: true,
    });
  }

  save(payload: ISaveClientCredentialPayload): Promise<ISaveClientCredentialResponse> {
    return http.post(AUTH_CLIENT_ENDPOINTS.SAVE, payload, undefined, {
      absoluteUrl: true,
    });
  }

  /** Makes a new secret; the response is the only time it is returned. The old secret stops working. */
  rotateSecret(payload: { itemId: string }): Promise<IRotateClientCredentialSecretResponse> {
    return http.post(
      `${AUTH_CLIENT_ENDPOINTS.ROTATE_SECRET}/${payload.itemId}/rotate-secret`,
      {},
      undefined,
      { absoluteUrl: true },
    );
  }

  delete(payload: { itemId: string }): Promise<APIResponse<{ isSuccess: boolean }>> {
    return http.delete(`${AUTH_CLIENT_ENDPOINTS.DELETE}/${payload.itemId}`, undefined, {
      absoluteUrl: true,
    });
  }
}

export const authClientService = {
  clients: new AuthClientsService(),
};
