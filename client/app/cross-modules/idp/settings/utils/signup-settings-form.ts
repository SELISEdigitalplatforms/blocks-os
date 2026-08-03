import type { IPermission } from "@blocks-idp/iam/models/permission";
import type { IRole } from "@blocks-idp/iam/models/role";
import { createRoleStub } from "@blocks-idp/iam/utils/role-stub";
import { z } from "zod";
import type {
  ISettingsSaveSignupConfigPayload,
  ISettingsSignupConfig,
} from "@blocks-idp/settings/models/settings.model";

export const signupSettingsFormSchema = z.object({
  isEmailPasswordSignUpEnabled: z.boolean(),
  defaultRolesForNewUser: z.array(z.string()),
  defaultPermissionsForNewUser: z.array(z.string()),
});

export type SignupSettingsFormValues = z.infer<typeof signupSettingsFormSchema>;

export const resolveSignupRoles = (roleSlugs: string[], availableRoles: IRole[]): IRole[] => {
  const bySlug = new Map(availableRoles.map((role) => [role.slug, role]));

  return roleSlugs.map((slug) => bySlug.get(slug) ?? createRoleStub({ slug }));
};

export const resolveSignupPermissions = (
  permissionNames: string[],
  availablePermissions: IPermission[],
): IPermission[] => {
  const byName = new Map(availablePermissions.map((permission) => [permission.name, permission]));

  return permissionNames.map(
    (name) =>
      byName.get(name) ?? {
        itemId: name,
        name,
        resource: "",
        type: 0,
        description: "",
        resourceGroup: "",
        projectKey: "",
        tags: [],
        roles: [],
        dependentPermissions: [],
        isArchived: false,
        isBuiltIn: false,
        language: null,
        organizationIds: [],
        permissionSeverity: 1,
      },
  );
};

export const toSignupSettingsFormValues = (
  config: ISettingsSignupConfig,
): SignupSettingsFormValues => ({
  isEmailPasswordSignUpEnabled: config.isEmailPasswordSignUpEnabled,
  defaultRolesForNewUser: config.defaultRolesForNewUser,
  defaultPermissionsForNewUser: config.defaultPermissionsForNewUser,
});

/** When signup disabled, roles/permissions must stay at loaded backend values — not in-session edits. */
export const applySignupDisabledOverrides = (
  values: SignupSettingsFormValues,
  config: ISettingsSignupConfig,
): SignupSettingsFormValues =>
  values.isEmailPasswordSignUpEnabled
    ? values
    : {
        ...values,
        defaultRolesForNewUser: config.defaultRolesForNewUser,
        defaultPermissionsForNewUser: config.defaultPermissionsForNewUser,
      };

export const buildSignupSettingsSavePayload = (
  values: SignupSettingsFormValues,
  config: ISettingsSignupConfig,
): ISettingsSaveSignupConfigPayload => {
  const normalized = applySignupDisabledOverrides(values, config);
  const signUpEnabled = normalized.isEmailPasswordSignUpEnabled;

  return {
    isSignUpEnable: signUpEnabled,
    isEmailPasswordSignUpEnabled: signUpEnabled,
    isSSoSignUpEnabled: signUpEnabled,
    defaultRolesForNewUserOnSignUp: normalized.defaultRolesForNewUser,
    defaultPermissionsForNewUserOnSignUp: normalized.defaultPermissionsForNewUser,
  };
};
