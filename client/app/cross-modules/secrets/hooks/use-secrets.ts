import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import { secretsService } from "@/services/secrets.service";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import type { SaveSecretRequest } from "@/cross-modules/secrets/constants/secret-key.enum";

// The secrets endpoints resolve the tenant from the request token, so the same
// URL returns different data per project. The active tenant must be part of the
// query key, otherwise switching projects serves the previous project's cache.
export const useGetSecrets = (secretKey: string, enabled = true) => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  return useQuery({
    queryKey: ["secrets", "list", tenantId, secretKey],
    queryFn: () => secretsService.gets(secretKey),
    enabled: enabled && !!secretKey && !!tenantId,
  });
};

export const useGetSecret = (itemId: string, enabled = true) => {
  return useQuery({
    queryKey: ["secrets", "item", itemId],
    queryFn: () => secretsService.get(itemId),
    enabled: enabled && !!itemId,
  });
};

export const useSaveSecret = () => {
  const queryClient = useQueryClient();
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  return useMutation({
    mutationFn: (payload: SaveSecretRequest) =>
      secretsService.save(payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["secrets", "list", tenantId, variables.secretKey],
      });
      showSuccessToast({ description: "Secret saved successfully." });
    },
    onError: (error) => {
      showErrorToast({ errors: error });
    },
  });
};

export const useDeleteSecret = () => {
  const queryClient = useQueryClient();
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  return useMutation({
    mutationFn: (itemId: string) =>
      secretsService.delete(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["secrets", "list", tenantId] });
      showSuccessToast({ description: "Secret deleted successfully." });
    },
    onError: (error) => {
      showErrorToast({ errors: error });
    },
  });
};
