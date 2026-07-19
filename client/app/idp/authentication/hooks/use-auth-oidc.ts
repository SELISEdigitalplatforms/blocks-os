import { authOidc } from "@blocks-idp/authentication/services/auth-clients-oidc.service";
import { ISaveOidcCredentialPayload } from "@blocks-idp/authentication/models/auth.oidc.model";
import { getBlocksOidcWellKnownUrl } from "@/lib/get-api-path";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const useGetAuthOidcCredentials = (options: { projectKey: string }) => {
  return useQuery({
    queryKey: ["authentication", "auth-oidc-list", options],
    queryFn: () => authOidc.clients.getOidcCredentials(),
    enabled: !!options.projectKey,
  });
};

export const useGetAuthOidcCredential = (
  options: { projectKey: string; clientId: string },
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["authentication", "auth-oidc", options],
    queryFn: () => authOidc.clients.getOidcCredential(options),
    enabled,
  });
};

export const useSaveAuthOidc = () => {
  const queryClient = useQueryClient();
  const tenantId = useProjectStore().selectedProject?.tenantId || "";

  return useMutation({
    mutationKey: ["authentication", "auth-oidc", "save"],
    mutationFn: (payload: ISaveOidcCredentialPayload) => {
      const savePayload: ISaveOidcCredentialPayload =
        payload.registerAsIdentityProvider && tenantId
          ? {
              ...payload,
              externalDiscoveryEndpoint: getBlocksOidcWellKnownUrl(tenantId),
            }
          : payload;
      return authOidc.clients.saveOidcCredential(savePayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["authentication"],
        exact: false,
      });
      queryClient.invalidateQueries({ queryKey: ["identity-providers"] });
    },
  });
};

export const useDeleteAuthOidc = (options: { projectKey: string }) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["authentication", "auth-oidc", "delete"],
    mutationFn: authOidc.clients.deleteOidcCredential,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["authentication", "auth-oidc-list", options],
      });
      queryClient.invalidateQueries({
        queryKey: ["authentication", "auth-oidc", options],
      });
    },
  });
};

export const useRotateAuthOidcSecret = (options: { projectKey: string }) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["authentication", "auth-oidc", "rotate-secret"],
    mutationFn: authOidc.clients.rotateOidcClientSecret,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["authentication", "auth-oidc-list", options],
      });
      queryClient.invalidateQueries({
        queryKey: ["authentication", "auth-oidc", options],
      });
    },
  });
};
