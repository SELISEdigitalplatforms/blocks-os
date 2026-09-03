import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { IOidcUiTemplate } from "@blocks-idp/authentication/models/auth.oidc.model";
import { authOidc } from "@blocks-idp/authentication/services/auth-clients-oidc.service";

const oidcTemplateQueryKey = (tenantId: string) => ["authentication", "oidc-template", tenantId];

export const useGetOidcTemplate = () => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";

  return useQuery({
    queryKey: oidcTemplateQueryKey(tenantId),
    queryFn: () => authOidc.clients.getOidcTemplate(),
    enabled: !!tenantId,
  });
};

export const useSaveOidcTemplate = () => {
  const queryClient = useQueryClient();
  const tenantId = useProjectStore().selectedProject?.tenantId || "";

  return useMutation({
    mutationKey: ["authentication", "oidc-template", "save", tenantId],
    mutationFn: (payload: IOidcUiTemplate) => authOidc.clients.saveOidcTemplate(payload),
    onSuccess: (response) => {
      if (response.isSuccess) {
        queryClient.invalidateQueries({ queryKey: oidcTemplateQueryKey(tenantId) });
      }
    },
  });
};
