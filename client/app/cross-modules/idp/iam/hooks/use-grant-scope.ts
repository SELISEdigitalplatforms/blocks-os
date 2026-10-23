import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useAuthStore } from "@seliseblocks/genesis-os/store";
import { grantScopeService } from "@blocks-idp/iam/services/grant-scope.service";
import {
  getManagedByCandidates,
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

  return useMemo(() => {
    const assignableRoles = isRestricted ? scope.assignableRoles : [];
    const heldPermissions = isRestricted ? scope.heldPermissions : [];
    const managedByCandidates = isRestricted ? getManagedByCandidates(scope) : [];
    const assignable = new Set(assignableRoles);
    const held = new Set(heldPermissions);
    return {
      scope,
      /** Waiting for the first answer; screens that filter by scope hold their lists until then. */
      isLoading: Boolean(tenantId) && query.isPending,
      isRestricted,
      assignableRoles,
      heldPermissions,
      managedByCandidates,
      canAssignRole: (slug: string) => !isRestricted || assignable.has(slug),
      canGrantPermission: (resource: string) => !isRestricted || held.has(resource),
    };
  }, [scope, isRestricted, query.isPending, tenantId]);
};

/**
 * Why a system-only screen (permissions admin, data access policies and security levels) is
 * read-only for this caller, or `undefined` when they may change it.
 */
export const useSystemOnlyReason = (): string | undefined => {
  const { isRestricted } = useGrantScope();
  return isRestricted ? SYSTEM_ONLY_TOOLTIP : undefined;
};
