import { z } from "zod"
import type {
  ISettingsOrganizationConfig,
  ISettingsSaveOrganizationConfigPayload,
} from "@blocks-idp/settings/models/settings.model"

export const organizationConfigFormSchema = z.object({
  allowOrgCreationFromCloud: z.boolean(),
  allowOrgCreationFromConstruct: z.boolean(),
  allowOrgCreationFromSignup: z.boolean(),
  allowOrgCreationFromPortal: z.boolean(),
})

export type OrganizationConfigFormValues = z.infer<typeof organizationConfigFormSchema>

export const buildEnableMultiOrgPayload = (
  config: ISettingsOrganizationConfig,
): ISettingsSaveOrganizationConfigPayload => ({
  allowOrgCreationFromCloud: config.allowCreationFromCloud,
  allowOrgCreationFromConstruct: config.allowCreationFromConstruct,
  allowOrgCreationFromSignup: config.allowOrgCreationFromSignup,
  allowOrgCreationFromPortal: config.allowOrgCreationFromPortal,
  isMultiOrgEnabled: true,
  consentForMultiOrgEnable: config.consentForMultiOrgEnable
    ? config.consentForMultiOrgEnable
    : true,
  defaultRolesOnOrgCreation: config.defaultRolesOnOrgCreation,
  defaultPermissionsOnOrgCreation: config.defaultPermissionsOnOrgCreation,
  keepOrgRolesSameAsDefaultRoles: config.keepOrgRolesSameAsDefaultRoles,
  keepOrgPermissionsSameAsDefaultPermissions: config.keepOrgPermissionsSameAsDefaultPermissions,
})

export const toOrganizationConfigFormValues = (
  config: ISettingsOrganizationConfig,
): OrganizationConfigFormValues => ({
  allowOrgCreationFromCloud: config.allowCreationFromCloud,
  allowOrgCreationFromConstruct: config.allowCreationFromConstruct,
  allowOrgCreationFromSignup: config.allowOrgCreationFromSignup,
  allowOrgCreationFromPortal: config.allowOrgCreationFromPortal,
})

export const buildOrganizationConfigSavePayload = (
  config: ISettingsOrganizationConfig,
  values: OrganizationConfigFormValues,
): ISettingsSaveOrganizationConfigPayload => ({
  allowOrgCreationFromCloud: values.allowOrgCreationFromCloud,
  allowOrgCreationFromConstruct: values.allowOrgCreationFromConstruct,
  allowOrgCreationFromSignup: values.allowOrgCreationFromSignup,
  allowOrgCreationFromPortal: values.allowOrgCreationFromPortal,
  isMultiOrgEnabled: config.isMultiOrgEnabled,
  consentForMultiOrgEnable: config.consentForMultiOrgEnable,
  defaultRolesOnOrgCreation: config.defaultRolesOnOrgCreation,
  defaultPermissionsOnOrgCreation: config.defaultPermissionsOnOrgCreation,
  keepOrgRolesSameAsDefaultRoles: config.keepOrgRolesSameAsDefaultRoles,
  keepOrgPermissionsSameAsDefaultPermissions: config.keepOrgPermissionsSameAsDefaultPermissions,
})
