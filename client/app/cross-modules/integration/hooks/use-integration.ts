import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { IIntegrationTemplate, IRunIntegrationSetupPayload } from "@/cross-modules/integration/models/integration.model";
import { integrationService } from "@/cross-modules/integration/services/integration.service";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";

const useTenantId = (): string => useProjectStore().selectedProject?.tenantId || "";

export const integrationQueryKeys = {
  templates: ["integration", "templates"] as const,
  template: (key: string) => ["integration", "template", key] as const,
  connections: (tenantId: string) => ["integration", "connections", tenantId] as const,
};

/** Shared by the manual and automatic runs, so each can tell when the other is in progress. */
export const integrationRunSetupMutationKey = (tenantId: string) =>
  ["integration", "run-setup", tenantId] as const;

export const useIntegrationTemplates = (enabled = true) =>
  useQuery({
    queryKey: integrationQueryKeys.templates,
    queryFn: () => integrationService.getTemplates(),
    enabled,
  });

export const useIntegrationTemplate = (key?: string) =>
  useQuery({
    queryKey: integrationQueryKeys.template(key ?? ""),
    queryFn: () => integrationService.getTemplate(key!, true),
    enabled: !!key,
  });

export const useIntegrationConnections = () => {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: integrationQueryKeys.connections(tenantId),
    queryFn: async () => (await integrationService.getConnections()).data ?? [],
    enabled: !!tenantId,
  });
};

export const useRunIntegrationSetup = () => {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: integrationRunSetupMutationKey(tenantId),
    mutationFn: (payload: IRunIntegrationSetupPayload) => integrationService.runSetup(payload),
    onSuccess: () => {
      showSuccessToast({ description: "Integration is set up." });
      queryClient.invalidateQueries({ queryKey: ["integration"] });
    },
    onError: (error) => {
      showErrorToast({ title: "Setup failed", errors: error instanceof Error ? error.message : error });
      // Steps before the failure may have succeeded; refresh so the page reflects them.
      queryClient.invalidateQueries({ queryKey: ["integration"] });
    },
  });
};

export const useDisconnect = () => { const queryClient = useQueryClient(); return useMutation({ mutationFn: integrationService.disconnect, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integration"] }) }); };
export const useRegenerateSecret = () => { const queryClient = useQueryClient(); return useMutation({ mutationFn: integrationService.regenerateSecret, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integration"] }) }); };
