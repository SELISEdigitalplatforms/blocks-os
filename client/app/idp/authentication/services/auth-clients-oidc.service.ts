import { http } from "@/lib/http-client";
import { APIResponse } from "@/models/api-response";
import {
  IDeleteOidcClientPayload,
  IDeleteOidcClientResponse,
  IGetOidcPayload,
  IGetOidcCredentialsResponse,
  IRotateOidcClientSecretPayload,
  IRotateOidcClientSecretResponse,
  ISaveOidcCredentialPayload,
  ISaveOidcCredentialResponse,
  IOidcConfig,
} from "@blocks-idp/authentication/models/auth.oidc.model";
import { AUTH_OIDC_ENDPOINTS } from "../constants/endpoint.constant";

export class AuthOidc {
  async getOidcCredentials(): Promise<IGetOidcCredentialsResponse> {
    return http.get(AUTH_OIDC_ENDPOINTS.GET_OIDC_CLIENTS, undefined, {
      absoluteUrl: true,
    });
  }

  async getOidcCredential(payload: IGetOidcPayload): Promise<{
    oIDCClientCredential: IOidcConfig;
    errors: Record<string, string> | null;
    isSuccess: boolean;
  }> {
    return http.get(
      `${AUTH_OIDC_ENDPOINTS.GET_OIDC_CLIENT}/${payload.clientId}`,
      undefined,
      { absoluteUrl: true },
    );
  }

  saveOidcCredential(
    payload: ISaveOidcCredentialPayload,
  ): Promise<APIResponse<ISaveOidcCredentialResponse>> {
    return http.post(AUTH_OIDC_ENDPOINTS.SAVE_OIDC_CLIENT, payload, undefined, {
      absoluteUrl: true,
    });
  }

  deleteOidcCredential(
    payload: IDeleteOidcClientPayload,
  ): Promise<APIResponse<IDeleteOidcClientResponse>> {
    return http.delete(
      `${AUTH_OIDC_ENDPOINTS.DELETE_OIDC_CLIENT}/${payload.itemId}`,
      undefined,
      { absoluteUrl: true },
    );
  }

  rotateOidcClientSecret(
    payload: IRotateOidcClientSecretPayload,
  ): Promise<IRotateOidcClientSecretResponse> {
    return http.post(
      `${AUTH_OIDC_ENDPOINTS.ROTATE_OIDC_CLIENT_SECRET}/${payload.itemId}/rotate-secret`,
      {},
      undefined,
      { absoluteUrl: true },
    );
  }
}

export const authOidc = {
  clients: new AuthOidc(),
};
