export type CredentialMode = "Passwordless" | "PasswordRequired";

/**
 * Oidc ends the redemption at an authorize URL the browser follows. Embedded returns tokens
 * to the construct, which hosts its own join screen — so it carries no client and no redirect,
 * because there is no client registration to validate a destination against.
 */
export type SignupLinkMode = "Oidc" | "Embedded";

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
  mode: SignupLinkMode;
  joinUrl: string | null;
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
  mode: SignupLinkMode;
  joinUrl?: string;
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
  | "mode"
  | "joinUrl"
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
  Mode: "mode",
  JoinUrl: "joinUrl",
  DefaultLifetimeMinutes: "defaultLifetimeMinutes",
};
