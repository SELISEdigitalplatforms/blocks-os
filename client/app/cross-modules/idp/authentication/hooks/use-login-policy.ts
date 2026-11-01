import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { loginPolicyService } from "@blocks-idp/authentication/services/login-policy.service";
import type { ITenantLoginPolicy } from "@blocks-idp/authentication/models/login-policy.model";

const QUERY_KEY = ["authentication", "login-policy"] as const;

// The endpoint resolves the tenant from the token, so the tenant is part of the key.
export const useGetTenantLoginPolicy = (enabled: boolean = true) => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  return useQuery({
    queryKey: [...QUERY_KEY, tenantId],
    queryFn: () => loginPolicyService.getTenantPolicy(),
    enabled: enabled && !!tenantId,
  });
};

export const useSaveTenantLoginPolicy = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...QUERY_KEY, "save"],
    mutationFn: (policy: ITenantLoginPolicy) => loginPolicyService.saveTenantPolicy(policy),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
};
