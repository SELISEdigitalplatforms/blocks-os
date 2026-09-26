/** A Connect template, served from the shared `BlocksConfiguration` database. */
export interface IConnectTemplate {
  itemId: string;
  key: string;
  displayName: string;
  description?: string | null;
  roleName: string;
  roleSlug: string;
  roleDescription?: string | null;
  /** Permission resource names, resolved to this project's permission ids at setup time. */
  permissions: string[];
  clientCredentialName: string;
  accessTokenValidForNumberMinutes: number;
  isActive: boolean;
}

/** The project's completed setup. Holds references only; the secret stays with IAM. */
export interface IConnectSetup {
  itemId: string;
  templateKey: string;
  templateDisplayName: string;
  roleId: string;
  roleSlug: string;
  clientCredentialId: string;
  createdDate: string;
  createdBy?: string | null;
}

export interface IGetConnectSetupResponse {
  data: IConnectSetup | null;
  errors?: Record<string, string> | null;
}

export interface ISaveConnectSetupPayload {
  templateKey: string;
  roleId: string;
  roleSlug: string;
  clientCredentialId: string;
}

export interface ISaveConnectSetupResponse {
  isSuccess: boolean;
  itemId?: string;
  errors?: Record<string, string> | null;
}

/** What the result card shows and what "Copy as JSON" copies. */
export interface IConnectDetails {
  clientId: string;
  clientSecret: string;
  xBlocksKey: string;
  baseUrl: string;
  domain: string;
}
