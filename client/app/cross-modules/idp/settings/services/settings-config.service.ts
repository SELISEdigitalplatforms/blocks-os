import { authenticationService } from "@blocks-idp/authentication/services/authentication.service";
import type { ISaveAuthConfigResponse } from "@blocks-idp/authentication/models/auth-configuration.model";
import type { IOrganizationConfigResponse } from "@blocks-idp/iam/models/organization-config.model";
import type { IGetSignUpSettingResponse } from "@blocks-idp/iam/models/user";
import { organizationService } from "@blocks-idp/iam/services/organization.service";
import { userService } from "@blocks-idp/iam/services/user.service";
import type {
  ISettingsAuthConfig,
  ISettingsOrganizationConfig,
  ISettingsSaveAuthConfigPayload,
  ISettingsSaveOrganizationConfigPayload,
  ISettingsSaveSignupConfigPayload,
  ISettingsSignupConfig,
} from "@blocks-idp/settings/models/settings.model";
import { normalizeAuthConfigResponse } from "@blocks-idp/settings/utils/normalize-auth-config";

const mapOrganizationConfig = (
  response: IOrganizationConfigResponse,
): ISettingsOrganizationConfig => ({
  itemId: response.itemId,
  allowCreationFromCloud: response.allowCreationFromCloud,
  allowCreationFromConstruct: response.allowCreationFromConstruct,
  allowOrgCreationFromSignup: response.allowOrgCreationFromSignup,
  allowOrgCreationFromPortal: response.allowOrgCreationFromPortal,
  isMultiOrgEnabled: response.isMultiOrgEnabled,
  consentForMultiOrgEnable: response.consentForMultiOrgEnable,
  defaultRolesOnOrgCreation: response.defaultRoleOnOrgCreation,
  defaultPermissionsOnOrgCreation: response.defaultPermissionOnOrgCreation,
  keepOrgRolesSameAsDefaultRoles: response.keepOrgRolesSameAsDefaultRoles,
  keepOrgPermissionsSameAsDefaultPermissions:
    response.keepOrgPermissionsSameAsDefaultPermissions,
});

const mapSignupConfig = (
  response: IGetSignUpSettingResponse,
): ISettingsSignupConfig => ({
  isSignUpEnable: response.isSignUpEnable,
  isEmailPasswordSignUpEnabled: response.isEmailPasswordSignUpEnabled,
  isSSoSignUpEnabled: response.isSSoSignUpEnabled,
  defaultRolesForNewUser: response.defaultRolesForNewUser ?? [],
  defaultPermissionsForNewUser: response.defaultPermissionsForNewUser ?? [],
});

export class SettingsConfigService {
  getAuthConfig(): Promise<ISettingsAuthConfig> {
    return authenticationService.configuration
      .getConfig()
      .then((response) => normalizeAuthConfigResponse(response));
  }

  saveAuthConfig(
    payload: ISettingsSaveAuthConfigPayload,
  ): Promise<ISaveAuthConfigResponse> {
    return authenticationService.configuration.saveAuthConfig({
      ...payload,
      allowedGrantTypes: payload.allowedGrantTypes,
      projectKey: "",
      isSelfSignUpAllowed: false,
    });
  }

  getOrganizationConfig(): Promise<ISettingsOrganizationConfig> {
    return organizationService.getOrganizationConfig().then((response) => {
      if (!response) {
        throw new Error("Organization config not found");
      }

      return mapOrganizationConfig(response);
    });
  }

  saveOrganizationConfig(
    payload: ISettingsSaveOrganizationConfigPayload,
  ): Promise<{ isSuccess: boolean; errors?: unknown }> {
    return organizationService.saveOrganizationConfig(payload);
  }

  getSignUpSetting(): Promise<ISettingsSignupConfig> {
    return userService.getSignUpSetting().then(mapSignupConfig);
  }

  saveSignUpSetting(
    payload: ISettingsSaveSignupConfigPayload,
  ): Promise<{ isSuccess: boolean; itemId?: string; errors?: unknown }> {
    return userService.saveSignUpSetting(payload);
  }
}

export const settingsConfigService = new SettingsConfigService();
