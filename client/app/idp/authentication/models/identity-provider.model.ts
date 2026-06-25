export type IdentityProviderType = "oidc" | "oauth2" | "saml" | "ldap" | "social" | (string & {});

export type Protocol = "oidc" | "saml" | (string & {});

export type TokenEndpointAuthMethod = "client_secret_basic" | "client_secret_post" | "none";

export interface IdentityProvider {
  itemId?: string;
  provider: string;
  displayName: string;
  description?: string;
  providerType: IdentityProviderType;
  protocol?: Protocol;
  tokenEndpointAuthMethod: TokenEndpointAuthMethod;
  clientId: string;
  clientSecret: string;
  issuer?: string | null;
  authorizationUrl?: string | null;
  tokenUrl?: string | null;
  userInfoUrl?: string | null;
  jwksUri?: string;
  wellKnownUrl?: string | null;
  redirectUris?: string[];
  redirectUri?: string[];
  scope?: string;
  responseType?: string | null;
  grantTypes?: string[];
  requirePkce?: boolean;
  isActive: boolean;
  audience?: string;
  initialRoles?: string[];
  initialPermissions?: string[];
  icon?: string | null;
  teamId?: string | null;
  keyId?: string | null;
  privateKey?: string | null;
  appleAudience?: string | null;
  createdDate?: string;
  lastUpdatedDate?: string;
  createdBy?: string;
  lastUpdatedBy?: string;
  language?: string | null;
  organizationId?: string;
  tags?: string[];
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
