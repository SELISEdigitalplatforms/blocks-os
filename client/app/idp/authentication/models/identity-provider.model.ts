export type IdentityProviderType = "oidc" | "oauth2" | "saml" | "ldap";

export interface IdentityProvider {
  itemId?: string;
  name: string;
  displayName: string;
  description?: string;
  providerType: IdentityProviderType;
  clientId: string;
  clientSecret?: string;
  issuerUrl?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  jwksUri?: string;
  scope?: string;
  redirectUri?: string;
  isActive: boolean;
  createdDate?: string;
  updatedDate?: string;
}

export interface UpdateStatusRequest {
  isActive: boolean;
}

export interface IdentityProviderResponse {
  isSuccess: boolean;
  errors: Record<string, string[]> | null;
  data?: IdentityProvider;
}

export interface IdentityProvidersResponse {
  isSuccess: boolean;
  errors: Record<string, string[]> | null;
  data?: IdentityProvider[];
}
