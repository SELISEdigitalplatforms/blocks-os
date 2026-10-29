import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useAuthStore } from "@seliseblocks/genesis-os/store";
import { grantScopeService } from "@blocks-idp/iam/services/grant-scope.service";
import {
  getManagedByCandidates,
  getRoleEditBlock,
  getRolePermissionCap,
  isScopeDescendant,
  isScopeRestricted,
  SYSTEM_ONLY_TOOLTIP,
} from "@blocks-idp/iam/utils/grant-scope";

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * The caller's grant scope, loaded once and shared by every screen (same query key).
 *
 * Fails open on purpose: if the endpoint is missing (older IAM) or errors, the UI is not limited.
 * The server is the only enforcer; this only saves the user a refused request.
 */
export const useGrantScope = () => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  // The answer is for the token's organization, so each organization gets its own cache entry.
  const organizationId = useAuthStore().user?.org_id ?? "";
  const query = useQuery({
    queryKey: ["iam", "grant-scope", tenantId, organizationId],
    queryFn: () => grantScopeService.getScope(),
    enabled: Boolean(tenantId),
    retry: false,
    staleTime: FIVE_MINUTES,
  });

  const scope = query.data;
  const isRestricted = isScopeRestricted(scope);
  const isDescendant = isScopeDescendant(scope);

  return useMemo(() => {
    const assignableRoles = isRestricted ? scope.assignableRoles : [];
    const rolePermissionCap = isDescendant ? getRolePermissionCap(scope) : [];
    const managedByCandidates = isDescendant ? getManagedByCandidates(scope) : [];
    const assignable = new Set(assignableRoles);
    const cap = new Set(rolePermissionCap);
    return {
      scope,
      /** Waiting for the first answer; screens that filter by scope hold their lists until then. */
      isLoading: Boolean(tenantId) && query.isPending,
      /** A known non-system caller: system-only screens are read-only. */
      isRestricted,
      /** A top user: the organization's owner. */
      isTopUser: isRestricted && Boolean(scope.isTopUser),
      /** A descendant: acts only below its own roles and never gives direct permissions. */
      isDescendant,
      assignableRoles,
      /** What a descendant may put on a role below it. */
      rolePermissionCap,
      managedByCandidates,
      canAssignRole: (slug: string) => !isRestricted || assignable.has(slug),
      /** A permission on a role: a descendant only one of its own. */
      canPutOnRole: (resource: string) => !isDescendant || cap.has(resource),
      /** A direct permission (to a user or a client): never for a descendant. */
      canGrantDirectPermission: !isDescendant,
      /** Why this role is locked for the caller, or `undefined`. */
      roleEditBlock: (role: { slug: string; createdFromDefault?: boolean }) => getRoleEditBlock(scope, role),
    };
  }, [scope, isRestricted, isDescendant, query.isPending, tenantId]);
};

/**
 * Why a system-only screen (permissions admin, data access policies and security levels) is
 * read-only for this caller, or `undefined` when they may change it.
 */
export const useSystemOnlyReason = (): string | undefined => {
  const { isRestricted } = useGrantScope();
  return isRestricted ? SYSTEM_ONLY_TOOLTIP : undefined;
};
