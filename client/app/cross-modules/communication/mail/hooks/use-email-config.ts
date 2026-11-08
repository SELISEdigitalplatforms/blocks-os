import { useProjectStore } from "@seliseblocks/genesis-os";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { emailService } from "@blocks-communication/mail/services/email.services";

export const useGetEmailConfigs = (pageNumber: number, pageSize: number) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: ["email-configs", tenantId, pageNumber, pageSize],
    queryFn: () => emailService.fetchEmailConfigs(pageNumber, pageSize),
  });
};

/**
 * The configurations the Email page lists: all of them without an organization, or one
 * organization's plus the Default organization's.
 */
export const useGetEmailSecretConfigs = (organizationId?: string, enabled = true) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: ["email-configs", tenantId, organizationId ?? "all"],
    queryFn: () => emailService.getEmailSecretConfigs(0, 10, organizationId),
    enabled,
  });
};

/** How many templates use a configuration; fetched only while a card is expanded or a delete is confirmed. */
export const useGetEmailConfigUsage = (configurationId: string, enabled = true) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: ["email-config-usage", tenantId, configurationId],
    queryFn: () => emailService.getConfigurationUsage(configurationId),
    enabled: enabled && !!configurationId,
  });
};

export const useSaveEmailConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["email-config", "add"],
    mutationFn: emailService.saveMailConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-configs"] });
      // An Office 365 save can create or rotate its linked secret — or, for a repair, create a
      // new one — so the Secrets page list is stale too.
      queryClient.invalidateQueries({ queryKey: ["secrets", "list"] });
    },
  });
};

export const useDeleteEmailConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["email-config", "delete"],
    mutationFn: emailService.deleteMailConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-configs"] });
    },
  });
};
