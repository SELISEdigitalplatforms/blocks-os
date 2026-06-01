export enum SecretType {
  OIDC = "OIDC",
  Captcha = "Captcha",
  SSO = "SSO",
  OwnSSO = "OwnSSO",
  ExternalIdP = "ExternalIdP",
}

export const SECRET_TYPE_OPTIONS = [
  { value: SecretType.OIDC, label: "OIDC" },
  { value: SecretType.Captcha, label: "Captcha" },
  { value: SecretType.OwnSSO, label: "Bring your own SSO" },
  { value: SecretType.ExternalIdP, label: "External IdP" },
] as const;

// ----- Payload Value types per SecretKey -----

export interface OIDCSecretValue {
  clientDisplayName: string;
  redirectUri: string;
  audience: string;
  scope: string;
  isAutoRedirect: string;
  clientBrandColor: string;
  clientLogoUrl: string;
  clientSecret: string;
}

export interface CaptchaSecretValue {
  CaptchaProvider: string;
  CaptchaSiteKey: string;
  CaptchaSecretKey: string;
  CaptchaGeneratorType: string;
}

export interface SSOSecretValue {
  ClientId: string;
  ClientSecret: string;
  RedirectUrl: string;
  Audience: string;
  WellKnownUrl: string;
}

export interface OwnSSOSecretValue {
  provider: string;
  audience: string;
  clientId: string;
  clientSecret: string;
  redirectUrl: string;
  wellKnownUrl: string;
}

export interface ExternalIdPSecretValue {
  ProviderName: string;
  JwksUrl: string;
  PublicCertificatePath: string;
  Issuer: string;
  Audiences: string;
  Password: string;
}

export type SecretValueMap = {
  [SecretType.OIDC]: OIDCSecretValue;
  [SecretType.Captcha]: CaptchaSecretValue;
  [SecretType.SSO]: SSOSecretValue;
  [SecretType.OwnSSO]: OwnSSOSecretValue;
  [SecretType.ExternalIdP]: ExternalIdPSecretValue;
};

export type AddSecretPayload<K extends SecretType = SecretType> = {
  secretKey: K;
  keyValuePairs: SecretValueMap[K];
};

export interface SaveSecretRequest {
  secretKey: string;
  keyValuePairs: Record<string, unknown>;
  projectKey?: string;
  itemId?: string;
}

export interface SecretItem {
  itemId: string;
  secretKey: string;
  keyValuePairs: Record<string, string>;
  createdDate?: string;
  lastUpdatedDate?: string;
  createdBy?: string;
  lastUpdatedBy?: string;
  organizationIds?: string[];
  tags?: string[];
  language?: string | null;
}
