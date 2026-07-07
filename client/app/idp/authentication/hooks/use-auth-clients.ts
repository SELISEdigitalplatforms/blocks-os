import { authClientService } from "@blocks-idp/authentication/services/auth-clients.service";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const useListAuthClientCredentials = (options: { projectKey: string }) => {
  return useQuery({
    queryKey: ["authentication", "auth-clients", options],
    queryFn: () => authClientService.clients.list(options),
  });
};

export const useGetAuthClientCredentials = (options: { projectKey: string }) => {
  return useListAuthClientCredentials(options);
};

export const useSaveAuthClient = (options: { projectKey: string }) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["authentication", "auth-clients", "save", options],
    mutationFn: authClientService.clients.save,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["authentication", "auth-clients"] });
    },
  });
};

export const useDeleteAuthClient = (options: { projectKey: string }) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["authentication", "auth-clients", "delete", options],
    mutationFn: (p: { itemId: string }) => authClientService.clients.delete(p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["authentication", "auth-clients"] });
    },
  });
};
