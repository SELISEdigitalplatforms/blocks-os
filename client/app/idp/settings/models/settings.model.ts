export type SettingsTabValue =
  | "iam-config"
  | "auth-config"
  | "organization-config"
  | "signup-settings"

export interface ISettingsAuthConfig {
  itemId: string
  allowedGrantTypes: string[]
  accessTokenValidForNumberMinutes: number
  refreshTokenValidForNumberMinutes: number
  absoluteRefreshTokenValidForNumberMinutes: number
  rememberMeRefreshTokenValidForNumberMinutes: number
  getNumberOfWrongAttemptsToLockTheAccount: number
  accountLockDurationInMinutes: number
  publicCertificatePath: string
  accountActivationPath: string
  accountVerificationPath: string
  recoverAccountPath: string
  isOidcEnabled: boolean
  accountActionBaseUrl: string
  useAccountActionBaseUrlAsDefault: boolean
  activationUrlLifetimeInMinutes: number
  recoverAccountUrlLifetimeInMinutes: number
  logoutOnPasswordChange: boolean
  passwordStrengthCheckerRegex: string
}

export interface ISettingsOrganizationConfig {
  itemId: string
  allowCreationFromCloud: boolean
  allowCreationFromConstruct: boolean
  allowOrgCreationFromSignup: boolean
  allowOrgCreationFromPortal: boolean
  isMultiOrgEnabled: boolean
  defaultRoleOnOrgCreation: string[]
  defaultPermissionOnOrgCreation: string[]
}

export interface ISettingsSignupConfig {
  itemId: string
  isSignUpEnable: boolean
  isEmailPasswordSignUpEnabled: boolean
  isSSoSignUpEnabled: boolean
  defaultRolesForNewUser: string[]
  defaultPermissionsForNewUser: string[]
}
