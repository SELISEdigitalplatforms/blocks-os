import { IGrantScope } from "@blocks-idp/iam/models/grant-scope";
import { tStatic } from "@seliseblocks/genesis-os";

const I18N_MODULE = "os.idp.iam";

export const getAssignableRolesHelper = () =>
  tStatic(I18N_MODULE, "GRANT_SCOPE.ASSIGNABLE_ROLES_HELPER");
export const getGrantPermissionTooltip = () =>
  tStatic(I18N_MODULE, "GRANT_SCOPE.GRANT_PERMISSION_TOOLTIP");
export const getDirectPermissionsHelper = () =>
  tStatic(I18N_MODULE, "GRANT_SCOPE.DIRECT_PERMISSIONS_HELPER");
export const getCannotManageUserTooltip = () =>
  tStatic(I18N_MODULE, "GRANT_SCOPE.CANNOT_MANAGE_USER_TOOLTIP");
export const getOwnRolesTooltip = () => tStatic(I18N_MODULE, "GRANT_SCOPE.OWN_ROLES_TOOLTIP");
export const getSystemOnlyTooltip = () => tStatic(I18N_MODULE, "GRANT_SCOPE.SYSTEM_ONLY_TOOLTIP");
export const getDefaultCopyTooltip = () => tStatic(I18N_MODULE, "GRANT_SCOPE.DEFAULT_COPY_TOOLTIP");
export const getOwnRoleTooltip = () => tStatic(I18N_MODULE, "GRANT_SCOPE.OWN_ROLE_TOOLTIP");
export const getRoleAboveTooltip = () => tStatic(I18N_MODULE, "GRANT_SCOPE.ROLE_ABOVE_TOOLTIP");

/**
 * True for a known, non-system caller: system-only screens are read-only for it. The server always
 * enforces the rules.
 */
export const isScopeRestricted = (scope: IGrantScope | undefined): scope is IGrantScope =>
  scope !== undefined && !scope.isSystemUser;

/** True for a descendant: a non-system caller that is not a top user. It acts only below its roles. */
export const isScopeDescendant = (scope: IGrantScope | undefined): scope is IGrantScope =>
  isScopeRestricted(scope) && !scope.isTopUser;

/** Roles a descendant may pick as "Managed by": its power roles and the roles below them. */
export const getManagedByCandidates = (scope: IGrantScope): string[] => [
  ...new Set([...(scope.powerRoles ?? scope.heldRoles), ...scope.managedRoles]),
];

/** What a descendant may put on a role: its own permissions (older IAM: everything it holds). */
export const getRolePermissionCap = (scope: IGrantScope): string[] =>
  scope.ownPermissions ?? scope.heldPermissions;

type RoleLike = { slug: string; createdFromDefault?: boolean };

/** Why the caller may not edit this role, or `undefined` when it may (rule R5 as far as the client can see). */
export const getRoleEditBlock = (
  scope: IGrantScope | undefined,
  role: RoleLike,
): string | undefined => {
  if (!isScopeRestricted(scope)) return undefined;
  if (role.createdFromDefault) return getDefaultCopyTooltip();
  if (scope.heldRoles.includes(role.slug)) return getOwnRoleTooltip();
  if (scope.isTopUser || scope.managedRoles.includes(role.slug)) return undefined;
  return getRoleAboveTooltip();
};

/**
 * Rule R3 as far as the client can see it. A top user manages every member. A descendant only a
 * user whose roles are all below it (or a base role it holds too that gives no power) and whose
 * direct permissions its own roles carry.
 */
export const canManageUserAccess = (
  scope: IGrantScope | undefined,
  user: { roles: string[]; permissions: string[] },
): boolean => {
  if (!isScopeDescendant(scope)) return true;
  const below = new Set(scope.managedRoles);
  const power = new Set(scope.powerRoles ?? scope.heldRoles);
  const sharedBase = new Set(scope.heldRoles.filter((slug) => !power.has(slug)));
  const own = new Set(getRolePermissionCap(scope));
  return (
    user.roles.every((slug) => below.has(slug) || sharedBase.has(slug)) &&
    user.permissions.every((resource) => own.has(resource))
  );
};
