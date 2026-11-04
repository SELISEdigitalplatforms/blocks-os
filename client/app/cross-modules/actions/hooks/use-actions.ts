import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { actionsService } from "../services/actions.service";
import type { IAction, IUpdateActionPayload } from "../models/actions.model";

// The tenant is part of the key: the endpoint reads it from the token, so switching project must
// not show the previous project's actions.
export const useActionsQueryKey = () => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  return ["actions", "gets", tenantId] as const;
};

export const useGetActions = () => {
  const queryKey = useActionsQueryKey();
  return useQuery({ queryKey, queryFn: () => actionsService.gets() });
};

/**
 * Flips one switch at once and puts it back if the server refuses, so the page never keeps a
 * state the server does not have.
 */
export const useUpdateAction = () => {
  const queryClient = useQueryClient();
  const queryKey = useActionsQueryKey();

  return useMutation({
    mutationKey: ["actions", "update"],
    mutationFn: (payload: IUpdateActionPayload) => actionsService.update(payload),
    onMutate: async ({ name, target, enabled }) => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<IAction[]>(queryKey, (actions) =>
        actions?.map((action) =>
          action.name === name ? { ...action, [target]: enabled } : action,
        ),
      );
    },
    // Undo only this one flag: another switch may have been flipped while this call was in flight.
    onError: (_error, { name, target, enabled }) => {
      queryClient.setQueryData<IAction[]>(queryKey, (actions) =>
        actions?.map((action) =>
          action.name === name ? { ...action, [target]: !enabled } : action,
        ),
      );
    },
    // Refetch once the last in-flight change is done, so an early refetch cannot undo a later one.
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: ["actions", "update"] }) <= 1) {
        return queryClient.invalidateQueries({ queryKey });
      }
      return undefined;
    },
  });
};
