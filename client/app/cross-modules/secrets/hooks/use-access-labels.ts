import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useGetRoles } from "@blocks-idp/iam/hooks/use-roles";
import { userService } from "@blocks-idp/iam/services/user.service";

/**
 * Resolves the identifiers stored in a secret's access list to readable labels.
 *
 * A secret's access list holds identifiers, not names: `userIds` are user GUIDs and `roles` are
 * role **slugs**, because that is what the JWT `roles` claim carries and what
 * `SecretAuthorizationService` compares against. Names exist for display only, so every lookup
 * here falls back to the raw identifier — an id that cannot be resolved still has to be visible
 * and removable.
 */

export const userDisplayName = (user: {
  firstName?: string;
  lastName?: string;
  email?: string;
  itemId: string;
}): string => {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || user.email || user.itemId;
};

/** userId -> label. Fans out over the by-id endpoint; there is no bulk users-by-ids call. */
export const useResolvedUserNames = (userIds: string[]): Record<string, string> => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";

  return useQueries({
    queries: userIds.map((id) => ({
      queryKey: ["user-by-id", { id, projectKey: tenantId }],
      queryFn: () => userService.getUserById({ id, projectKey: tenantId }),
      retry: false,
      staleTime: 5 * 60 * 1000,
    })),
    combine: (results) => {
      const labels: Record<string, string> = {};
      userIds.forEach((id, index) => {
        const user = results[index]?.data?.data;
        labels[id] = user ? userDisplayName({ ...user, itemId: id }) : id;
      });
      return labels;
    },
  });
};

/** roleSlug -> role name, via the role list endpoint's `slugs` filter. */
export const useResolvedRoleNames = (slugs: string[]): Record<string, string> => {
  const { data } = useGetRoles(
    { page: 0, pageSize: Math.max(slugs.length, 1), filter: { slugs } },
    { enabled: slugs.length > 0 },
  );

  return useMemo(() => {
    const labels: Record<string, string> = {};
    for (const slug of slugs) labels[slug] = slug;
    for (const role of data?.data ?? []) labels[role.slug] = role.name || role.slug;
    return labels;
  }, [slugs, data]);
};
