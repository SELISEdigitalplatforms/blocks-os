import { http } from "@/lib/http/http-client";
import {
  DeleteIdentityProviderResponse,
  IdentityProvider,
  IdentityProviderResponse,
  IdentityProvidersResponse,
  UpdateStatusRequest,
} from "@blocks-idp/authentication/models/identity-provider.model";
import { IDENTITY_PROVIDER_ENDPOINTS } from "@blocks-idp/authentication/constants/endpoint.constant";

export class IdentityProviderService {
  getAll(): Promise<IdentityProvidersResponse> {
    return http.get(IDENTITY_PROVIDER_ENDPOINTS.GET_ALL, undefined, {
      absoluteUrl: true,
    });
  }

  getById(id: string): Promise<IdentityProviderResponse> {
    return http.get(`${IDENTITY_PROVIDER_ENDPOINTS.GET_BY_ID}/${id}`, undefined, {
      absoluteUrl: true,
    });
  }

  create(provider: IdentityProvider): Promise<IdentityProviderResponse> {
    // protocol is a fixed wire-only field with no form representation.
    return http.post(
      IDENTITY_PROVIDER_ENDPOINTS.CREATE,
      { ...provider, protocol: "oidc" },
      undefined,
      { absoluteUrl: true },
    );
  }

  update(id: string, provider: IdentityProvider): Promise<IdentityProviderResponse> {
    // protocol is a fixed wire-only field with no form representation.
    return http.put(
      `${IDENTITY_PROVIDER_ENDPOINTS.UPDATE}/${id}`,
      { ...provider, protocol: "oidc" },
      undefined,
      { absoluteUrl: true },
    );
  }

  updateStatus(id: string, request: UpdateStatusRequest): Promise<IdentityProviderResponse> {
    return http.patch(
      `${IDENTITY_PROVIDER_ENDPOINTS.UPDATE_STATUS}/${id}/status`,
      request,
      undefined,
      { absoluteUrl: true },
    );
  }

  delete(id: string): Promise<DeleteIdentityProviderResponse> {
    return http.delete(`${IDENTITY_PROVIDER_ENDPOINTS.DELETE}/${id}`, undefined, {
      absoluteUrl: true,
    });
  }
}

export const identityProviderService = new IdentityProviderService();
