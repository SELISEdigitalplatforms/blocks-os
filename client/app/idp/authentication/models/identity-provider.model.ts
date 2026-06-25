export type IdentityProviderType = "oidc" | "oauth2" | "saml" | "ldap" | "social" | (string & {});

export type TokenEndpointAuthMethod = "client_secret_basic" | "client_secret_post" | "none";

export interface IdentityProvider {
  itemId?: string;
  provider: string;
  displayName: string;
  description?: string;
  providerType: IdentityProviderType;
  tokenEndpointAuthMethod: TokenEndpointAuthMethod;
  clientId: string;
  clientSecret: string;
  issuerUrl?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  jwksUri?: string;
  scope?: string;
  redirectUri?: string[];
  isActive: boolean;
  audience?: string;
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
