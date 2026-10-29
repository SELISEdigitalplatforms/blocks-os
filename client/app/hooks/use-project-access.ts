import { projectAccessService } from "@blocks-identifier/services/project-access.service";
import {
  IMenuGrant,
  ISaveAccessPolicyPayload,
  VIEW_ACTION,
} from "@blocks-identifier/models/project-access.model";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

const ACCESS_KEY = ["identifier", "project-access"] as const;

/**
 * The caller's own grants for a project group.
 *
 * Kept separate from `useGetPeople`: the environments page used to call People/Gets purely to
 * read its `isOwner` flag, which now needs the `people::view` grant — so a contributor granted
 * only `environments::*` would have been bounced off a page that has nothing to do with People.
 */
export const useGetMyAccess = (projectGroupId?: string) => {
  return useQuery({
    queryKey: [...ACCESS_KEY, "mine", projectGroupId],
    queryFn: () => projectAccessService.getMyAccess(projectGroupId as string),
    enabled: Boolean(projectGroupId),
    // Grants change rarely and this gates the whole subtree, so it is read on nearly every
    // page. Holding it briefly avoids a refetch on each navigation within the project.
    staleTime: 60 * 1000,
  });
};

/**
 * Convenience view over {@link useGetMyAccess}: `can("people", "invite")`, plus the menu ids the
 * sidebar should keep.
 */
export const useProjectPermissions = (projectGroupId?: string) => {
  const { data, isLoading, isError } = useGetMyAccess(projectGroupId);

  return useMemo(() => {
    const menus: IMenuGrant[] = data?.menus ?? [];
    const isOwner = data?.isOwner ?? false;
    const granted = new Set(
      menus.flatMap((menu) => menu.actions.map((action) => `${menu.menuId}::${action}`)),
    );

    return {
      isLoading,
      isError,
      isOwner,
      role: data?.role ?? "contributor",
      environments: data?.environments ?? [],
      menuIds: menus.map((menu) => menu.menuId),
      /** For an owner this is the whole catalog, so it doubles as "everything grantable". */
      menus,
      /** Any granted menu, or ownership, is enough to open the project shell. */
      hasAnyAccess: isOwner || menus.length > 0,
      /** Owners hold everything implicitly, so they short-circuit every check. */
      can: (menuId: string, action: string = VIEW_ACTION) =>
        isOwner || granted.has(`${menuId}::${action}`),
    };
  }, [data, isLoading, isError]);
};

export const useSaveAccessPolicy = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [...ACCESS_KEY, "save"],
    mutationFn: (payload: ISaveAccessPolicyPayload) =>
      projectAccessService.saveAccessPolicy(payload),
    onSuccess: () => {
      // Both sides of the pair: the edited member's policy, and the caller's own access — an
      // owner editing their way through the list should not be served a stale sidebar.
      queryClient.invalidateQueries({ queryKey: ACCESS_KEY });
      queryClient.invalidateQueries({ queryKey: ["people"] });
    },
  });
};
