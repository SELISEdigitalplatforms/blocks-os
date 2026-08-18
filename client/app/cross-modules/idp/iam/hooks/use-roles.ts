import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { normalizeArchiveErrors } from "../constants/archive-error-messages";
import { roleService } from "@blocks-idp/iam/services/role.service";
import { GetRolesPayload } from "@blocks-idp/iam/models/role";

export const useGetRoles = (
  option: GetRolesPayload,
  { enabled = true }: { enabled?: boolean } = {},
) => {
  return useQuery({
    queryKey: ["roles", option],
    queryFn: () => roleService.getRoles(option),
    enabled,
  });
};

export const useGetRoleById = (options: { id: string; projectKey: string }) => {
  return useQuery({
    queryKey: ["role", options],
    queryFn: () => roleService.getRoleById(options),
  });
};

export const useAddRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["role", "add"],
    mutationFn: roleService.addRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });
};

/**
 * Archives a role.
 *
 * The `isSuccess === false` check lives here rather than in the component on purpose: `mutateAsync`
 * only resolves after react-query has already classified the result and run `onSuccess`, so a
 * component-level guard would show the right error toast while the list had *already* refetched.
 * Throwing inside `mutationFn` keeps `onSuccess` — and therefore invalidation — honest.
 *
 * These endpoints return 400 on failure, so this path should be unreachable; it costs nothing and
 * the contract lives in another repo on another deploy cadence.
 */
export const useDeleteRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["role", "delete"],
    mutationFn: async (id: string) => {
      const response = await roleService.deleteRole(id);
      if (response?.isSuccess === false) {
        throw Object.assign(new Error("Archive failed"), {
          errors: normalizeArchiveErrors(response) ?? { general: "Archive failed" },
        });
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });
};

export const useUpdateRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["role", "update"],
    mutationFn: roleService.updateRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });
};

// The role slug travels to the server in the mutation payload (SetRoles.slug), not as a hook
// argument, and the mutationKey below is never read back, so this takes no parameters.
export const useSetRoles = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["permissions", "set roles"],
    mutationFn: roleService.setRoles,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["permissions"] });
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });
};
