import { IDelegationScope } from "@blocks-idp/iam/models/delegation-scope";

export const ASSIGNABLE_ROLES_HELPER = "You can assign roles whose permissions you hold.";
export const GRANT_PERMISSION_TOOLTIP = "You can grant only permissions you hold.";
export const CANNOT_MANAGE_USER_TOOLTIP = "You can't manage this user.";
export const OWN_ROLES_TOOLTIP = "You can't change your own roles.";
export const SYSTEM_ONLY_TOOLTIP = "Only the system user can change this.";

/**
 * True when the UI must limit choices: a known, non-system caller. The server always enforces the
 * rules, so the client limits every such caller.
 */
export const isScopeRestricted = (scope: IDelegationScope | undefined): scope is IDelegationScope =>
  scope !== undefined && !scope.isSystemUser;

/** Roles that may be picked as "Managed by": the ones the caller holds or manages. */
export const getManagedByCandidates = (scope: IDelegationScope): string[] => [
  ...new Set([...scope.heldRoles, ...scope.managedRoles]),
];

/** Rule R3 as far as the client can see it: every role is assignable and every permission is held. */
export const canManageUserAccess = (
  scope: IDelegationScope | undefined,
  user: { roles: string[]; permissions: string[] },
): boolean => {
  if (!isScopeRestricted(scope)) return true;
  const roles = new Set(scope.assignableRoles);
  const permissions = new Set(scope.heldPermissions);
  return (
    user.roles.every((slug) => roles.has(slug)) &&
    user.permissions.every((resource) => permissions.has(resource))
  );
};
