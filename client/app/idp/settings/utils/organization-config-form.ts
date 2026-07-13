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
  isMultiOrgEnabled: z.boolean(),
})

export type OrganizationConfigFormValues = z.infer<typeof organizationConfigFormSchema>

export const toOrganizationConfigFormValues = (
  config: ISettingsOrganizationConfig,
): OrganizationConfigFormValues => ({
  allowOrgCreationFromCloud: config.allowCreationFromCloud,
  allowOrgCreationFromConstruct: config.allowCreationFromConstruct,
  allowOrgCreationFromSignup: config.allowOrgCreationFromSignup,
  allowOrgCreationFromPortal: config.allowOrgCreationFromPortal,
  isMultiOrgEnabled: config.isMultiOrgEnabled,
})

export const buildOrganizationConfigSavePayload = (
  config: ISettingsOrganizationConfig,
  values: OrganizationConfigFormValues,
): ISettingsSaveOrganizationConfigPayload => ({
  allowOrgCreationFromCloud: values.allowOrgCreationFromCloud,
  allowOrgCreationFromConstruct: values.allowOrgCreationFromConstruct,
  allowOrgCreationFromSignup: values.allowOrgCreationFromSignup,
  allowOrgCreationFromPortal: values.allowOrgCreationFromPortal,
  isMultiOrgEnabled: values.isMultiOrgEnabled,
  // Turning multi-org on is what grants consent; it is never revoked once given.
  consentForMultiOrgEnable: values.isMultiOrgEnabled || config.consentForMultiOrgEnable,
  defaultRolesOnOrgCreation: config.defaultRolesOnOrgCreation,
  defaultPermissionsOnOrgCreation: config.defaultPermissionsOnOrgCreation,
  keepOrgRolesSameAsDefaultRoles: config.keepOrgRolesSameAsDefaultRoles,
  keepOrgPermissionsSameAsDefaultPermissions: config.keepOrgPermissionsSameAsDefaultPermissions,
})
