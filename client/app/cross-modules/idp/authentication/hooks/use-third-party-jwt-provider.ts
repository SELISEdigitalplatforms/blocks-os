import { projectService } from "@blocks-identifier/services/project.service";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const PROVIDERS_KEY = "get-third-party-jwt-providers";

/** Configured external identity providers. Never returns a signing secret. */
export const useGetThirdPartyJwtProviders = (projectKey: string, enabled: boolean = true) =>
  useQuery({
    queryKey: [PROVIDERS_KEY, projectKey],
    queryFn: () => projectService.getThirdPartyJwtProviders(),
    enabled: !!projectKey && enabled,
  });

export const useSaveThirdPartyJwtProvider = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: projectService.saveThirdPartyJwtProvider,
    onSuccess: () => {
      // Adding a provider can flip a sibling's header from optional to required, so the whole
      // list is refetched rather than the saved row patched in.
      queryClient.invalidateQueries({ queryKey: [PROVIDERS_KEY] });
    },
  });
};

export const useDeleteThirdPartyJwtProvider = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: projectService.deleteThirdPartyJwtProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROVIDERS_KEY] });
    },
  });
};

export const useUpdateThirdPartyJwtEnabled = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: projectService.updateThirdPartyJwtEnabled,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["get-token-validation"] });
    },
  });
};
