import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
