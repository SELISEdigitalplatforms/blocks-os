import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { authClientService } from "@blocks-idp/authentication/services/auth-clients.service";
import { IIntegrationTemplate } from "@/cross-modules/integration/models/integration.model";
import { integrationService } from "@/cross-modules/integration/services/integration.service";
import {
  INTEGRATION_SETUP_STEP_LABELS,
  IntegrationSetupError,
  IntegrationSetupStep,
  runIntegrationSetup,
} from "@/cross-modules/integration/services/integration-setup.runner";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";

const useTenantId = (): string => useProjectStore().selectedProject?.tenantId || "";

export const integrationQueryKeys = {
  templates: ["integration", "templates"] as const,
  setup: (tenantId: string) => ["integration", "setup", tenantId] as const,
  credential: (tenantId: string, credentialId: string) =>
    ["integration", "credential", tenantId, credentialId] as const,
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

export const useIntegrationSetup = () => {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: integrationQueryKeys.setup(tenantId),
    queryFn: async () => (await integrationService.getSetup()).data ?? null,
    enabled: !!tenantId,
  });
};

/**
 * The credential Integration issued, secret included. IAM's list is the only read that returns
 * the secret, so the credential is picked from it by id.
 */
export const useIntegrationCredential = (credentialId?: string) => {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: integrationQueryKeys.credential(tenantId, credentialId ?? ""),
    queryFn: async () => {
      const credentials = await authClientService.clients.list({ projectKey: tenantId });
      return credentials.find((credential) => credential.itemId === credentialId) ?? null;
    },
    enabled: !!tenantId && !!credentialId,
  });
};

export const useRunIntegrationSetup = (onStep?: (step: IntegrationSetupStep) => void) => {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: integrationRunSetupMutationKey(tenantId),
    mutationFn: (template: IIntegrationTemplate) =>
      runIntegrationSetup({ template, projectKey: tenantId, onStep }),
    onSuccess: () => {
      showSuccessToast({ description: "Integration is set up." });
      queryClient.invalidateQueries({ queryKey: ["integration"] });
      queryClient.invalidateQueries({ queryKey: ["authentication", "auth-clients"] });
    },
    onError: (error) => {
      const title =
        error instanceof IntegrationSetupError
          ? `${INTEGRATION_SETUP_STEP_LABELS[error.step]} failed`
          : "Setup failed";
      showErrorToast({ title, errors: error instanceof Error ? error.message : error });
      // Steps before the failure may have succeeded; refresh so the page reflects them.
      queryClient.invalidateQueries({ queryKey: ["integration"] });
    },
  });
};
