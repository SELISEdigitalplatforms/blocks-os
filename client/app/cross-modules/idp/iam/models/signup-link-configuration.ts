export type CredentialMode = "Passwordless" | "PasswordRequired";

export interface ISignupLinkConfiguration {
  itemId: string;
  name: string;
  description: string | null;
  defaultRoles: string[];
  defaultPermissions: string[];
  clientId: string;
  redirectUri: string;
  defaultForwardedTo: string | null;
  credentialMode: CredentialMode;
  defaultLifetimeMinutes: number;
  defaultMaxRedemptions: number | null;
  isActive: boolean;
  createdDate: string;
  lastUpdatedDate: string;
}

export interface ISignupLinkConfigurationQueryPayload {
  page: number;
  pageSize: number;
  includeInactive: boolean;
  search?: string;
}

export interface ISignupLinkConfigurationQueryResponse {
  items: ISignupLinkConfiguration[];
  totalCount: number;
}

export interface ISignupLinkConfigurationMutationResponse {
  isSuccess: boolean;
  itemId: string;
  errors?: Record<string, string>;
}

export interface ISignupLinkConfigurationCreatePayload {
  name: string;
  description?: string;
  defaultRoles: string[];
  defaultPermissions: string[];
  clientId: string;
  redirectUri: string;
  defaultForwardedTo?: string;
  credentialMode: CredentialMode;
  defaultLifetimeMinutes?: number;
  defaultMaxRedemptions?: number | null;
}

export type ISignupLinkConfigurationUpdatePayload = Partial<ISignupLinkConfigurationCreatePayload> & {
  itemId: string;
};

/** Maps IAM PascalCase field errors onto form field names. */
export const SIGNUP_LINK_CONFIGURATION_FIELD_ERROR_MAP: Record<
  string,
  | "name"
  | "description"
  | "clientId"
  | "redirectUri"
  | "defaultRoles"
  | "defaultPermissions"
  | "defaultForwardedTo"
  | "credentialMode"
  | "defaultLifetimeMinutes"
> = {
  Name: "name",
  Description: "description",
  ClientId: "clientId",
  RedirectUri: "redirectUri",
  DefaultRoles: "defaultRoles",
  DefaultPermissions: "defaultPermissions",
  DefaultForwardedTo: "defaultForwardedTo",
  CredentialMode: "credentialMode",
  DefaultLifetimeMinutes: "defaultLifetimeMinutes",
};
