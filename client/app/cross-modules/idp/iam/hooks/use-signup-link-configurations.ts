import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { signupLinkConfigurationService } from "../services/signup-link-configuration.service";
import {
  ISignupLinkConfigurationCreatePayload,
  ISignupLinkConfigurationQueryPayload,
  ISignupLinkConfigurationUpdatePayload,
} from "../models/signup-link-configuration";

export const useGetSignupLinkConfigurations = (
  payload: ISignupLinkConfigurationQueryPayload,
  { enabled = true }: { enabled?: boolean } = {},
) => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  return useQuery({
    queryKey: ["signup-link-configurations", payload, tenantId],
    queryFn: () => signupLinkConfigurationService.query(payload),
    enabled: enabled && !!tenantId,
  });
};

export const useGetSignupLinkConfigurationById = (
  id: string,
  { enabled = true }: { enabled?: boolean } = {},
) => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  return useQuery({
    queryKey: ["signup-link-configurations", "detail", id, tenantId],
    queryFn: () => signupLinkConfigurationService.getById(id),
    enabled: enabled && !!tenantId && !!id,
  });
};

export const useCreateSignupLinkConfiguration = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["signup-link-configurations", "create"],
    mutationFn: (payload: ISignupLinkConfigurationCreatePayload) =>
      signupLinkConfigurationService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signup-link-configurations"] });
    },
  });
};

export const useUpdateSignupLinkConfiguration = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["signup-link-configurations", "update"],
    mutationFn: (payload: ISignupLinkConfigurationUpdatePayload) =>
      signupLinkConfigurationService.update(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signup-link-configurations"] });
    },
  });
};

export const useArchiveSignupLinkConfiguration = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["signup-link-configurations", "archive"],
    mutationFn: async (id: string) => {
      const response = await signupLinkConfigurationService.archive(id);
      if (response?.isSuccess === false) {
        throw Object.assign(new Error("Archive failed"), {
          errors: response.errors ?? { general: "Archive failed" },
          status: 400,
        });
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signup-link-configurations"] });
    },
  });
};
