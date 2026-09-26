import { useEffect } from "react";
import { useIsMutating } from "@tanstack/react-query";
import { useImpersonateStore, useProjectStore } from "@seliseblocks/genesis-os";
import { useGetProject, useGetProjectStatus } from "@/hooks/use-project";
import {
  connectRunSetupMutationKey,
  useConnectSetup,
  useConnectTemplates,
  useRunConnectSetup,
} from "@/cross-modules/connect/hooks/use-connect";
import {
  claimAutoSetupAttempt,
  pickAutoSetupTemplate,
} from "@/cross-modules/connect/utils/connect-auto-setup";

/**
 * Whether the open environment belongs to a template project that still needs Connect.
 *
 * Only true when the session, the selected project and `Project/Get` all name the same tenant:
 * setup writes to whichever tenant the session is impersonating, so acting while they disagree
 * (mid-switch between environments) could set up the wrong one.
 */
export const useConnectAutoSetupState = () => {
  const selectedTenantId = useProjectStore().selectedProject?.tenantId ?? "";
  const { isImpersonated, impersonatedTenantId } = useImpersonateStore();
  const { data: projectResponse } = useGetProject();
  const project = projectResponse?.data;

  const inScope =
    isImpersonated &&
    !!selectedTenantId &&
    impersonatedTenantId === selectedTenantId &&
    project?.tenantId === selectedTenantId;
  const isTemplate = inScope && project?.projectType === "template";

  // Setup needs the permissions provisioning copies into the tenant, so it waits for it.
  const { data: isProvisioned } = useGetProjectStatus(isTemplate ? project?.itemId : undefined);
  const { data: setup, isSuccess: isSetupLoaded } = useConnectSetup();
  const isRunning =
    useIsMutating({ mutationKey: connectRunSetupMutationKey(selectedTenantId) }) > 0;

  return {
    tenantId: selectedTenantId,
    isTemplate,
    isProvisioned: isProvisioned === true,
    isRunning,
    needsSetup: isTemplate && isProvisioned === true && isSetupLoaded && setup === null,
  };
};

/** Runs Connect setup once per environment of a template project, without user input. */
export const useConnectAutoSetup = () => {
  const { tenantId, needsSetup, isRunning } = useConnectAutoSetupState();
  const { data: templates } = useConnectTemplates(needsSetup);
  const { mutate: runSetup } = useRunConnectSetup();

  useEffect(() => {
    if (!needsSetup || isRunning || !templates) return;
    const template = pickAutoSetupTemplate(templates);
    if (!template || !claimAutoSetupAttempt(tenantId)) return;
    runSetup(template);
  }, [needsSetup, isRunning, templates, tenantId, runSetup]);
};
