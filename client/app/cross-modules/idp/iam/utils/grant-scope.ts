import { IGrantScope } from "@blocks-idp/iam/models/grant-scope";

export const ASSIGNABLE_ROLES_HELPER = "You can give only roles below your role.";
export const GRANT_PERMISSION_TOOLTIP = "Your role doesn't have this permission.";
export const DIRECT_PERMISSIONS_HELPER = "Only a top admin can give permissions directly. Give a role instead.";
export const CANNOT_MANAGE_USER_TOOLTIP = "You can't manage this user.";
export const OWN_ROLES_TOOLTIP = "You can't change your own roles.";
export const SYSTEM_ONLY_TOOLTIP = "Only the system user can change this.";
export const DEFAULT_COPY_TOOLTIP = "Comes from default. Only the system user can change it.";
export const OWN_ROLE_TOOLTIP = "This is your role. Ask an admin above you to change it.";
export const ROLE_ABOVE_TOOLTIP = "This role is not below your role.";

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
export const getRoleEditBlock = (scope: IGrantScope | undefined, role: RoleLike): string | undefined => {
  if (!isScopeRestricted(scope)) return undefined;
  if (role.createdFromDefault) return DEFAULT_COPY_TOOLTIP;
  if (scope.heldRoles.includes(role.slug)) return OWN_ROLE_TOOLTIP;
  if (scope.isTopUser || scope.managedRoles.includes(role.slug)) return undefined;
  return ROLE_ABOVE_TOOLTIP;
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
