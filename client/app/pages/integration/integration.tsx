import { useProjectStore } from "@seliseblocks/genesis-os";
import { Loader2, Plug, RotateCw } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Banner } from "@/components/ui-kits/banner/banner";
import { Button } from "@/components/ui-kits/button/button";
import { IntegrationDetailsCard } from "@/cross-modules/integration/components/integration-details-card";
import { IntegrationSetupModal } from "@/cross-modules/integration/components/integration-setup-modal";
import {
  useIntegrationCredential,
  useIntegrationSetup,
  useIntegrationTemplates,
} from "@/cross-modules/integration/hooks/use-integration";
import {
  resolveIntegrationBaseUrl,
  resolveProjectDomain,
} from "@/cross-modules/integration/utils/integration-details";

export default function IntegrationPage() {
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const selectedProject = useProjectStore().selectedProject;
  const { data: templates = [] } = useIntegrationTemplates();
  const {
    data: setup,
    isLoading: isSetupLoading,
    isError: isSetupError,
    refetch: refetchSetup,
    isFetching: isSetupFetching,
  } = useIntegrationSetup();
  const {
    data: credential,
    isLoading: isCredentialLoading,
    isError: isCredentialError,
  } = useIntegrationCredential(setup?.clientCredentialId);

  const templateLabel = setup?.templateDisplayName ?? templates[0]?.displayName ?? "Localization";

  if (isSetupLoading || (setup && isCredentialLoading)) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-medium-emphasis" />
      </div>
    );
  }

  // Without the record the page cannot tell whether setup already ran, so it must not offer
  // Setup: running it again would reach the save step and be refused as already configured.
  if (isSetupError && !setup) {
    return (
      <Banner variant="destructive" title="Could not load Integration setup" compact={false}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>Check your connection and try again.</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => refetchSetup()}
            disabled={isSetupFetching}
          >
            <RotateCw className="h-4 w-4" />
            <span className="ml-2">Retry</span>
          </Button>
        </div>
      </Banner>
    );
  }

  const credentialWarning = !setup
    ? undefined
    : isCredentialError
      ? "The client credential could not be loaded. You may not have access to client credentials."
      : !credential
        ? "The client credential created by setup no longer exists. It may have been deleted in Client Credentials."
        : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Plug className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium">{templateLabel}</p>
            {!setup && <p className="text-xs text-medium-emphasis">Not connected</p>}
          </div>
        </div>
        {setup ? (
          <Badge variant="success">Active</Badge>
        ) : (
          <Button size="sm" onClick={() => setIsSetupOpen(true)}>
            Setup
          </Button>
        )}
      </div>

      {setup ? (
        <IntegrationDetailsCard
          title={`${setup.templateDisplayName} integration details`}
          warning={credentialWarning}
          details={{
            clientId: setup.clientCredentialId,
            clientSecret: credential?.clientSecret ?? "",
            xBlocksKey: selectedProject?.tenantId ?? "",
            baseUrl: resolveIntegrationBaseUrl(setup.templateKey),
            domain: resolveProjectDomain(selectedProject),
          }}
        />
      ) : (
        <div className="rounded-lg border border-border bg-card px-6 py-10 text-center">
          <h2 className="text-base font-semibold">Connect is not set up yet</h2>
          <p className="mt-1 text-sm text-medium-emphasis">
            Run setup to create a role and a client credential for {templateLabel}.
          </p>
        </div>
      )}

      <IntegrationSetupModal open={isSetupOpen} onOpenChange={setIsSetupOpen} />
    </div>
  );
}
