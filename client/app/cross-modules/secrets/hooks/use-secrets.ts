import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { secretsService } from "@/services/secrets.service";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import type { SaveSecretRequest } from "@/cross-modules/secrets/constants/secret-key.enum";

export const useGetSecrets = (secretKey: string, enabled = true) => {
  return useQuery({
    queryKey: ["secrets", "list", secretKey],
    queryFn: () => secretsService.gets(secretKey),
    enabled: enabled && !!secretKey,
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
  return useMutation({
    mutationFn: (payload: SaveSecretRequest) => secretsService.save(payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["secrets", "list", variables.secretKey] });
      showSuccessToast({ description: "Secret saved successfully." });
    },
    onError: (error) => {
      showErrorToast({ errors: error });
    },
  });
};
