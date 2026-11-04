import { tStatic } from "@seliseblocks/genesis-os";
import { z } from "zod";
import type {
  ISettingsOrganizationConfig,
  ISettingsSaveOrganizationConfigPayload,
} from "@blocks-idp/settings/models/settings.model";

export const organizationConfigFormSchema = z
  .object({
    allowOrgCreationFromCloud: z.boolean(),
    allowOrgCreationFromConstruct: z.boolean(),
    allowOrgCreationFromSignup: z.boolean(),
    allowOrgCreationFromPortal: z.boolean(),
    isMultiOrgEnabled: z.boolean(),
    isSignupAutoJoinEnabled: z.boolean(),
    signupAutoJoinOrganizationId: z.string(),
  })
  .superRefine((values, ctx) => {
    if (
      values.isMultiOrgEnabled &&
      values.isSignupAutoJoinEnabled &&
      values.signupAutoJoinOrganizationId.trim().length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["signupAutoJoinOrganizationId"],
        message: tStatic("os.idp.settings", "ORGANIZATION_CONFIG_FORM.AUTO_JOIN_REQUIRED"),
      });
    }
  });

export type OrganizationConfigFormValues = z.infer<typeof organizationConfigFormSchema>;

export const toOrganizationConfigFormValues = (
  config: ISettingsOrganizationConfig,
): OrganizationConfigFormValues => ({
  allowOrgCreationFromCloud: config.allowCreationFromCloud,
  allowOrgCreationFromConstruct: config.allowCreationFromConstruct,
  allowOrgCreationFromSignup: config.allowOrgCreationFromSignup,
  allowOrgCreationFromPortal: config.allowOrgCreationFromPortal,
  isMultiOrgEnabled: config.isMultiOrgEnabled,
  isSignupAutoJoinEnabled: config.isSignupAutoJoinEnabled ?? false,
  signupAutoJoinOrganizationId: config.signupAutoJoinOrganizationId ?? "",
});

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
  isSignupAutoJoinEnabled: values.isSignupAutoJoinEnabled,
  // The target is sent only while the toggle is on; off keeps the stored choice in IAM.
  ...(values.isSignupAutoJoinEnabled
    ? { signupAutoJoinOrganizationId: values.signupAutoJoinOrganizationId }
    : {}),
});
