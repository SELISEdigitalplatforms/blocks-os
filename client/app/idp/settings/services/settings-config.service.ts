import { authenticationService } from "@blocks-idp/authentication/services/authentication.service"
import type { IGetAuthConfigResponse } from "@blocks-idp/authentication/models/auth-configuration.model"
import { organizationService } from "@blocks-idp/iam/services/organization.service"
import type { IOrganizationConfigResponse } from "@blocks-idp/iam/models/organization-config.model"
import { userService } from "@blocks-idp/iam/services/user.service"
import type { IGetSignUpSettingResponse } from "@blocks-idp/iam/models/user"
import type {
  ISettingsAuthConfig,
  ISettingsOrganizationConfig,
  ISettingsSignupConfig,
} from "@blocks-idp/settings/models/settings.model"

const mapAuthConfig = (response: IGetAuthConfigResponse): ISettingsAuthConfig => ({
  itemId: response.itemId,
  allowedGrantTypes: response.allowedGrantTypes ?? [],
  accessTokenValidForNumberMinutes: response.accessTokenValidForNumberMinutes,
  refreshTokenValidForNumberMinutes: response.refreshTokenValidForNumberMinutes,
  absoluteRefreshTokenValidForNumberMinutes: response.absoluteRefreshTokenValidForNumberMinutes ?? 0,
  rememberMeRefreshTokenValidForNumberMinutes: response.rememberMeRefreshTokenValidForNumberMinutes,
  getNumberOfWrongAttemptsToLockTheAccount: response.getNumberOfWrongAttemptsToLockTheAccount,
  accountLockDurationInMinutes: response.accountLockDurationInMinutes,
  publicCertificatePath: response.publicCertificatePath ?? "",
  accountActivationPath: response.accountActivationPath ?? "",
  accountVerificationPath: response.accountVerificationPath ?? "",
  recoverAccountPath: response.recoverAccountPath ?? "",
  isOidcEnabled: response.isOidcEnabled ?? false,
  accountActionBaseUrl: response.accountActionBaseUrl ?? "",
  useAccountActionBaseUrlAsDefault: response.useAccountActionBaseUrlAsDefault ?? false,
  activationUrlLifetimeInMinutes: response.activationUrlLifetimeInMinutes ?? 0,
  recoverAccountUrlLifetimeInMinutes: response.recoverAccountUrlLifetimeInMinutes ?? 0,
  logoutOnPasswordChange: response.logoutOnPasswordChange ?? false,
  passwordStrengthCheckerRegex: response.passwordStrengthCheckerRegex ?? "",
})

const mapOrganizationConfig = (
  response: IOrganizationConfigResponse,
): ISettingsOrganizationConfig => ({
  itemId: response.itemId,
  allowCreationFromCloud: response.allowCreationFromCloud,
  allowCreationFromConstruct: response.allowCreationFromConstruct,
  allowOrgCreationFromSignup: response.allowOrgCreationFromSignup ?? false,
  allowOrgCreationFromPortal: response.allowOrgCreationFromPortal ?? false,
  isMultiOrgEnabled: response.isMultiOrgEnabled,
  defaultRoleOnOrgCreation: response.defaultRoleOnOrgCreation ?? [],
  defaultPermissionOnOrgCreation: response.defaultPermissionOnOrgCreation ?? [],
})

const mapSignupConfig = (response: IGetSignUpSettingResponse): ISettingsSignupConfig => ({
  itemId: response.itemId,
  isSignUpEnable: response.isSignUpEnable,
  isEmailPasswordSignUpEnabled: response.isEmailPasswordSignUpEnabled,
  isSSoSignUpEnabled: response.isSSoSignUpEnabled,
  defaultRolesForNewUser: response.defaultRolesForNewUser ?? [],
  defaultPermissionsForNewUser: response.defaultPermissionsForNewUser ?? [],
})

export class SettingsConfigService {
  getAuthConfig(projectKey: string): Promise<ISettingsAuthConfig> {
    if (!projectKey) {
      return Promise.reject(new Error("projectKey is required"))
    }

    return authenticationService.configuration
      .getConfig({ projectKey })
      .then(mapAuthConfig)
  }

  getOrganizationConfig(projectKey: string): Promise<ISettingsOrganizationConfig> {
    if (!projectKey) {
      return Promise.reject(new Error("projectKey is required"))
    }

    return organizationService.getOrganizationConfig(projectKey).then((response) => {
      if (!response) {
        throw new Error("Organization config not found")
      }

      return mapOrganizationConfig(response)
    })
  }

  getSignUpSetting(projectKey: string): Promise<ISettingsSignupConfig> {
    if (!projectKey) {
      return Promise.reject(new Error("projectKey is required"))
    }

    return userService.getSignUpSetting({ projectKey }).then(mapSignupConfig)
  }
}

export const settingsConfigService = new SettingsConfigService()
