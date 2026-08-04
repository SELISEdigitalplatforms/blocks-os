import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { storageService } from "../services/storage.service";

// `gets()` sends no project scope; the endpoint resolves the tenant from the request
// token. Without the active tenant in the query key, switching projects serves the
// previous project's storage configuration until a reload. The query is deliberately
// not gated on a selected project — see the "still query when no project is selected"
// case in the sibling test.
export const useGetStorageConfigurations = () => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  return useQuery({
    queryKey: ["storage", "configuration", "gets", tenantId],
    queryFn: () => storageService.configuration.gets(),
  });
};

export const useSaveStorageConfiguration = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["storage", "configuration", "save"],
    mutationFn: storageService.configuration.save,
    onSuccess: (data) => {
      if (data.isSuccess)
        queryClient.invalidateQueries({ queryKey: ["storage", "configuration", "gets"] });
    },
  });
};
export const useDeleteStorageConfiguration = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["storage", "configuration", "delete"],
    mutationFn: storageService.configuration.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["storage", "configuration", "gets"] });
    },
  });
};
