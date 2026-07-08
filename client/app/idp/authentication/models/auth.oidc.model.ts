export interface IGetOidcPayload {
  projectKey: string;
  clientId?: string;
}

export interface IOidcConfig {
  itemId: string;
  createdDate: string;
  lastUpdatedDate: string;
  createdBy: string;
  language: string;
  lastUpdatedBy: string;
  organizationIds: string[];
  tags: string[];
  clientSecret: string;
  redirectUris?: string[];
  redirectUri?: string;
  scope: string;
  audience: string;
  isAutoRedirect: boolean;
  isActive: boolean;
  requirePkce: boolean;
  allowedResponseTypes: string[];
  allowedServiceAccessResources?: string[];
  tenantId: string;
  clientLogoUrl?: string;
  clientBrandColor?: string;
  clientDisplayName: string;
}
export interface IGetOidcCredentialsResponse {
  oIDCClientCredentials: IOidcConfig[];
  errors: Record<string, string> | null;
  isSuccess: boolean;
}

export interface ISaveOidcCredentialPayload {
  audience: string;
  isAutoRedirect: boolean;
  isActive: boolean;
  itemId: string;
  projectKey: string;
  redirectUris: string[];
  scope: string;
  requirePkce: boolean;
  allowedResponseTypes: string[];
  allowedServiceAccessResources?: string[];
  clientLogoUrl?: string;
  clientBrandColor?: string;
  clientDisplayName: string;
}

export interface ISaveOidcCredentialResponse {
  audience: string;
  isAutoRedirect: boolean;
  isActive: boolean;
  itemId: string;
  projectKey: string;
  redirectUris: string[];
  scope: string;
  requirePkce: boolean;
  allowedResponseTypes: string[];
  allowedServiceAccessResources?: string[];
  clientLogoUrl?: string;
  clientBrandColor?: string;
  clientDisplayName: string;
}

export interface IGetClientsPayload {
  projectKey: string;
}

export interface IClientCredentialsConfig {
  itemId: string;
  name: string;
  clientSecret: string;
  accessTokenValidForNumberMinutes: number;
  roles: string[];
  permissions: string[];
  isActive: boolean;
  createdDate: string;
  lastUpdatedDate: string;
  createdBy: string;
  language: string;
  lastUpdatedBy: string;
  organizationId: string;
  tags: string[];
}

export interface ISaveClientCredentialPayload {
  itemId?: string | null;
  name: string;
  isActive: boolean;
  accessTokenValidForNumberMinutes: number;
  roles: string[];
  permissions: string[];
  projectKey: string;
}

export interface ISaveClientCredentialResponse {
  itemId: string;
  name: string;
  isActive: boolean;
  accessTokenValidForNumberMinutes: number;
  roles: string[];
  permissions: string[];
  isSuccess: boolean;
}

export interface TabValue {
  tabValue: string;
}
export interface IDeleteOidcClientPayload {
  itemId: string | null;
  projectKey: string;
}
export interface IDeleteOidcClientResponse {
  errors: {
    additionalProp1: string;
    additionalProp2: string;
    additionalProp3: string;
  };
  isSuccess: boolean;
}
