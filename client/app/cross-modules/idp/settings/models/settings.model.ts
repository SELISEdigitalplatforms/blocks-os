export type SettingsTabValue =
  "iam-config" | "auth-config" | "organization-config" | "signup-settings";

export interface ISettingsAuthConfig {
  itemId: string;
  allowedGrantTypes: string[];
  accessTokenValidForNumberMinutes: number;
  refreshTokenValidForNumberMinutes: number;
  absoluteRefreshTokenValidForNumberMinutes: number;
  rememberMeRefreshTokenValidForNumberMinutes: number;
  getNumberOfWrongAttemptsToLockTheAccount: number;
  accountLockDurationInMinutes: number;
  publicCertificatePath: string;
  accountActivationPath: string;
  accountVerificationPath: string;
  recoverAccountPath: string;
  isOidcEnabled: boolean;
  accountActionBaseUrl: string;
  useAccountActionBaseUrlAsDefault: boolean;
  activationUrlLifetimeInMinutes: number;
  recoverAccountUrlLifetimeInMinutes: number;
  logoutOnPasswordChange: boolean;
  passwordStrengthCheckerRegex: string;
}

export interface ISettingsOrganizationConfig {
  itemId: string;
  allowCreationFromCloud: boolean;
  allowCreationFromConstruct: boolean;
  allowOrgCreationFromSignup: boolean;
  allowOrgCreationFromPortal: boolean;
  isMultiOrgEnabled: boolean;
  consentForMultiOrgEnable: boolean;
  defaultRolesOnOrgCreation: string[];
  defaultPermissionsOnOrgCreation: string[];
  keepOrgRolesSameAsDefaultRoles: boolean;
  keepOrgPermissionsSameAsDefaultPermissions: boolean;
}

export interface ISettingsSaveOrganizationConfigPayload {
  allowOrgCreationFromCloud: boolean;
  allowOrgCreationFromConstruct: boolean;
  allowOrgCreationFromSignup: boolean;
  allowOrgCreationFromPortal: boolean;
  isMultiOrgEnabled: boolean;
  consentForMultiOrgEnable: boolean;
  defaultRolesOnOrgCreation: string[];
  defaultPermissionsOnOrgCreation: string[];
  keepOrgRolesSameAsDefaultRoles: boolean;
  keepOrgPermissionsSameAsDefaultPermissions: boolean;
}

export interface ISettingsSaveAuthConfigPayload {
  itemId: string;
  refreshTokenValidForNumberMinutes: number;
  absoluteRefreshTokenValidForNumberMinutes: number;
  accessTokenValidForNumberMinutes: number;
  rememberMeRefreshTokenValidForNumberMinutes: number;
  getNumberOfWrongAttemptsToLockTheAccount: number;
  accountLockDurationInMinutes: number;
  publicCertificatePath: string;
  accountActivationPath: string;
  accountVerificationPath: string;
  recoverAccountPath: string;
  isOidcEnabled: boolean;
  accountActionBaseUrl: string;
  useAccountActionBaseUrlAsDefault: boolean;
  activationUrlLifetimeInMinutes: number;
  recoverAccountUrlLifetimeInMinutes: number;
  logoutOnPasswordChange: boolean;
  passwordStrengthCheckerRegex: string;
  allowedGrantTypes: string[];
}

export interface ISettingsSignupConfig {
  isSignUpEnable: boolean;
  isEmailPasswordSignUpEnabled: boolean;
  isSSoSignUpEnabled: boolean;
  defaultRolesForNewUser: string[];
  defaultPermissionsForNewUser: string[];
}

export interface ISettingsSaveSignupConfigPayload {
  isSignUpEnable: boolean;
  isEmailPasswordSignUpEnabled: boolean;
  isSSoSignUpEnabled: boolean;
  defaultRolesForNewUserOnSignUp: string[];
  defaultPermissionsForNewUserOnSignUp: string[];
}
