import { projectService } from "@blocks-identifier/services/project.service";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const PROVIDERS_KEY = "get-third-party-jwt-providers";
const PROJECT_KEY = ["identifier", "project"] as const;

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
      // Phase 1 may lower IsThirdPartyJwtEnabled when the last active provider disappears —
      // refresh the project so the trust switch reflects server state without a reload.
      queryClient.invalidateQueries({ queryKey: [...PROJECT_KEY] });
    },
  });
};

export const useDeleteThirdPartyJwtProvider = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: projectService.deleteThirdPartyJwtProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROVIDERS_KEY] });
      queryClient.invalidateQueries({ queryKey: [...PROJECT_KEY] });
    },
  });
};

export const useUpdateThirdPartyJwtEnabled = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: projectService.updateThirdPartyJwtEnabled,
    // Returned so the mutation stays pending until the project has been refetched: resolving
    // earlier let the switch fall back to the old stored value for a moment before the new one
    // arrived. Must match useGetProject's key prefix so the switch re-renders from server state.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...PROJECT_KEY] }),
  });
};
