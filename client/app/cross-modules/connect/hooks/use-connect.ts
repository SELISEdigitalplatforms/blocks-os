import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { authClientService } from "@blocks-idp/authentication/services/auth-clients.service";
import { IConnectTemplate } from "@/cross-modules/connect/models/connect.model";
import { connectService } from "@/cross-modules/connect/services/connect.service";
import {
  CONNECT_SETUP_STEP_LABELS,
  ConnectSetupError,
  ConnectSetupStep,
  runConnectSetup,
} from "@/cross-modules/connect/services/connect-setup.runner";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";

const useTenantId = (): string => useProjectStore().selectedProject?.tenantId || "";

export const connectQueryKeys = {
  templates: ["connect", "templates"] as const,
  setup: (tenantId: string) => ["connect", "setup", tenantId] as const,
  credential: (tenantId: string, credentialId: string) =>
    ["connect", "credential", tenantId, credentialId] as const,
};

/** Shared by the manual and automatic runs, so each can tell when the other is in progress. */
export const connectRunSetupMutationKey = (tenantId: string) =>
  ["connect", "run-setup", tenantId] as const;

export const useConnectTemplates = (enabled = true) =>
  useQuery({
    queryKey: connectQueryKeys.templates,
    queryFn: () => connectService.getTemplates(),
    enabled,
  });

export const useConnectSetup = () => {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: connectQueryKeys.setup(tenantId),
    queryFn: async () => (await connectService.getSetup()).data ?? null,
    enabled: !!tenantId,
  });
};

/**
 * The credential Connect issued, secret included. IAM's list is the only read that returns the
 * secret, so the credential is picked from it by id.
 */
export const useConnectCredential = (credentialId?: string) => {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: connectQueryKeys.credential(tenantId, credentialId ?? ""),
    queryFn: async () => {
      const credentials = await authClientService.clients.list({ projectKey: tenantId });
      return credentials.find((credential) => credential.itemId === credentialId) ?? null;
    },
    enabled: !!tenantId && !!credentialId,
  });
};

export const useRunConnectSetup = (onStep?: (step: ConnectSetupStep) => void) => {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: connectRunSetupMutationKey(tenantId),
    mutationFn: (template: IConnectTemplate) =>
      runConnectSetup({ template, projectKey: tenantId, onStep }),
    onSuccess: () => {
      showSuccessToast({ description: "Connect is set up." });
      queryClient.invalidateQueries({ queryKey: ["connect"] });
      queryClient.invalidateQueries({ queryKey: ["authentication", "auth-clients"] });
    },
    onError: (error) => {
      const title =
        error instanceof ConnectSetupError
          ? `${CONNECT_SETUP_STEP_LABELS[error.step]} failed`
          : "Setup failed";
      showErrorToast({ title, errors: error instanceof Error ? error.message : error });
      // Steps before the failure may have succeeded; refresh so the page reflects them.
      queryClient.invalidateQueries({ queryKey: ["connect"] });
    },
  });
};
