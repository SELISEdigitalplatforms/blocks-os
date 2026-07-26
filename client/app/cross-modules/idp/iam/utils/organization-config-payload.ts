import type { IOrganizationConfigSaveApiPayload } from "@blocks-idp/iam/models/organization-config.model";

export const toOrganizationConfigSaveApiPayload = (
  payload: IOrganizationConfigSaveApiPayload,
): Record<string, unknown> => ({
  allowOrgCreationFromCloud: payload.allowOrgCreationFromCloud,
  allowOrgCreationFromConstruct: payload.allowOrgCreationFromConstruct,
  allowOrgCreationFromSignup: payload.allowOrgCreationFromSignup,
  allowOrgCreationFromPortal: payload.allowOrgCreationFromPortal,
  isMultiOrgEnabled: payload.isMultiOrgEnabled,
  ...(payload.consentForMultiOrgEnable
    ? { consentForMultiOrgEnable: payload.consentForMultiOrgEnable }
    : {}),
  defaultRolesOnOrgCreation: payload.defaultRolesOnOrgCreation ?? [],
  defaultPermissionsOnOrgCreation: payload.defaultPermissionsOnOrgCreation ?? [],
  keepOrgRolesSameAsDefaultRoles: payload.keepOrgRolesSameAsDefaultRoles,
  keepOrgPermissionsSameAsDefaultPermissions: payload.keepOrgPermissionsSameAsDefaultPermissions,
});
