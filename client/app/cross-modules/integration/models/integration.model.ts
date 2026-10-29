/** An Integration template, served from the shared `BlocksConfiguration` database. */
export interface IIntegrationTemplate {
  itemId: string;
  key: string;
  family: string;
  accessLevel: string;
  displayName: string;
  description?: string | null;
  roleName: string;
  roleSlug: string;
  roleDescription?: string | null;
  /** Permission resource names, resolved to this project's permission ids at setup time. */
  permissions: string[];
  clientCredentialName: string;
  accessTokenValidForNumberMinutes: number;
  baseUrl: string;
  sortOrder: number;
  isActive: boolean;
}

/** The project's completed setup. Holds references only; the secret stays with IAM. */
export interface IIntegrationSetup {
  itemId: string;
  templateKey: string;
  templateDisplayName: string;
  roleId: string;
  roleSlug: string;
  clientCredentialId: string;
  createdDate: string;
  createdBy?: string | null;
}

export interface IGetIntegrationSetupResponse {
  data: IIntegrationSetup | null;
  errors?: Record<string, string> | null;
}

export interface IIntegrationConnection extends IIntegrationSetup {
  connectionName: string;
  templateAccessLevel: string;
  siteUrl?: string | null;
  source: "manual" | "connect";
  status: "active" | "revoked";
  neverDelivered?: boolean;
}

export interface IRunIntegrationSetupPayload { templateKey: string; connectionName: string; }
export interface IRunIntegrationSetupResponse extends ISaveIntegrationSetupResponse {
  connectionId?: string; clientId?: string; clientSecret?: string; xBlocksKey?: string; baseUrl?: string; domain?: string;
}

export interface ISaveIntegrationSetupPayload {
  templateKey: string;
  roleId: string;
  roleSlug: string;
  clientCredentialId: string;
}

export interface ISaveIntegrationSetupResponse {
  isSuccess: boolean;
  itemId?: string;
  errors?: Record<string, string> | null;
}

/** What the result card shows and what "Copy as JSON" copies. */
export interface IIntegrationDetails {
  clientId: string;
  clientSecret: string;
  xBlocksKey: string;
  baseUrl: string;
  domain: string;
}
