export enum SecretType {
  OIDC = "OIDC",
  Captcha = "Captcha",
  SSO = "SSO",
  ExternalIdP = "ExternalIdP",
}

export const SECRET_TYPE_OPTIONS = [
  { value: SecretType.OIDC, label: "OIDC" },
  { value: SecretType.Captcha, label: "Captcha" },
  { value: SecretType.SSO, label: "Bring your own SSO" },
  { value: SecretType.ExternalIdP, label: "External IdP" },
] as const;

// ----- Payload Value types per SecretKey -----

export interface OIDCSecretValue {
  ClientDisplayName: string;
  RedirectUri: string;
  Audience: string;
  ClientBrandColor: string;
  ClientLogoUrl: string;
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
  [SecretType.ExternalIdP]: ExternalIdPSecretValue;
};

export type AddSecretPayload<K extends SecretType = SecretType> = {
  SecretType: K;
  Value: SecretValueMap[K];
};
