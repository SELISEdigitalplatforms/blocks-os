import type { IPermission } from "@blocks-idp/iam/models/permission";
import type { IRole } from "@blocks-idp/iam/models/role";
import { createPermissionStub } from "@blocks-idp/iam/utils/permission-stub";
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

/**
 * The backend stores a user's granted permissions as resources (they are matched against
 * `Permission.Resource`), so resources — not names — are the saved identity here, exactly as
 * role slugs are for roles. Configs saved before that fix hold names, so unmatched values fall
 * back to a name lookup; re-saving normalizes them to resources.
 */
export const resolveSignupPermissions = (
  permissionResources: string[],
  availablePermissions: IPermission[],
): IPermission[] => {
  const byResource = new Map(
    availablePermissions.map((permission) => [permission.resource, permission]),
  );
  const byName = new Map(availablePermissions.map((permission) => [permission.name, permission]));

  return permissionResources.map(
    (resource) =>
      byResource.get(resource) ?? byName.get(resource) ?? createPermissionStub({ resource }),
  );
};

/** Normalizes saved permission values (resources, or legacy names) to resources. */
export const toSignupPermissionResources = (
  permissionValues: string[],
  availablePermissions: IPermission[],
): string[] =>
  resolveSignupPermissions(permissionValues, availablePermissions).map(
    (permission) => permission.resource,
  );

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
