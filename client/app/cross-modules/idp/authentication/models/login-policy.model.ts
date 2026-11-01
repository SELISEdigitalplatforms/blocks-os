/** Project (tenant) rules: where users may sign in and with which method. */
export interface ITenantLoginPolicy {
  allowEmbedded: boolean;
  allowOidc: boolean;
  allowPassword: boolean;
  allowSocial: boolean;
}

export interface IGetTenantLoginPolicyResponse {
  isSuccess: boolean;
  loginPolicy: ITenantLoginPolicy;
  errors?: Record<string, string> | null;
}

export interface ISaveTenantLoginPolicyResponse {
  isSuccess: boolean;
  errors?: Record<string, string> | null;
}

export type OidcLoginMethod = "default" | "password" | "social";
export type OidcLoginProviders = "default" | "selected";

/** Sign-in rule of one OIDC client. `default` follows the project setting. */
export interface IOidcClientLoginPolicy {
  method: OidcLoginMethod;
  providers: OidcLoginProviders;
  selectedProviderIds: string[];
}
