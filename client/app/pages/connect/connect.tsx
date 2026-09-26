import { useProjectStore } from "@seliseblocks/genesis-os";
import { Loader2, Plug, RotateCw, Settings2 } from "lucide-react";
import { useState } from "react";
import { Banner } from "@/components/ui-kits/banner/banner";
import { Button } from "@/components/ui-kits/button/button";
import { ConnectDetailsCard } from "@/cross-modules/connect/components/connect-details-card";
import { ConnectSetupModal } from "@/cross-modules/connect/components/connect-setup-modal";
import { useConnectCredential, useConnectSetup } from "@/cross-modules/connect/hooks/use-connect";
import { useConnectAutoSetupState } from "@/cross-modules/connect/hooks/use-connect-auto-setup";
import {
  resolveConnectBaseUrl,
  resolveProjectDomain,
} from "@/cross-modules/connect/utils/connect-details";

export default function ConnectPage() {
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const selectedProject = useProjectStore().selectedProject;
  const {
    data: setup,
    isLoading: isSetupLoading,
    isError: isSetupError,
    refetch: refetchSetup,
    isFetching: isSetupFetching,
  } = useConnectSetup();
  const {
    data: credential,
    isLoading: isCredentialLoading,
    isError: isCredentialError,
  } = useConnectCredential(setup?.clientCredentialId);
  const autoSetup = useConnectAutoSetupState();

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
      <Banner variant="destructive" title="Could not load Connect setup" compact={false}>
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

  if (setup) {
    const credentialWarning = isCredentialError
      ? "The client credential could not be loaded. You may not have access to client credentials."
      : !credential
        ? "The client credential created by setup no longer exists. It may have been deleted in Client Credentials."
        : undefined;

    return (
      <ConnectDetailsCard
        title={`Connected to ${setup.templateDisplayName}`}
        warning={credentialWarning}
        details={{
          clientId: setup.clientCredentialId,
          clientSecret: credential?.clientSecret ?? "",
          xBlocksKey: selectedProject?.tenantId ?? "",
          baseUrl: resolveConnectBaseUrl(setup.templateKey),
          domain: resolveProjectDomain(selectedProject),
        }}
      />
    );
  }

  // A template project sets itself up. While that is pending the page says so instead of
  // offering Setup; once an automatic attempt has failed, Setup below is the way to retry.
  // Not while the modal is open: a manual run shares the mutation key, and replacing this
  // branch would unmount the modal mid-run.
  if (
    !isSetupOpen &&
    autoSetup.isTemplate &&
    (autoSetup.isRunning || !autoSetup.isProvisioned)
  ) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card px-6 py-16 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-medium-emphasis" />
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Setting up Connect</h2>
          <p className="text-sm text-medium-emphasis">
            {autoSetup.isRunning
              ? "This is a template project, so Connect is being set up automatically."
              : "This is a template project. Connect will be set up automatically once the environment is ready."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card px-6 py-16 text-center">
        <Plug className="h-10 w-10 text-medium-emphasis" />
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Connect is not set up yet</h2>
          <p className="text-sm text-medium-emphasis">
            Run setup to create a role and a client credential for Blocks Localization.
          </p>
        </div>
        <Button size="sm" onClick={() => setIsSetupOpen(true)}>
          <Settings2 className="h-4 w-4" />
          <span className="ml-2">Setup</span>
        </Button>
      </div>
      <ConnectSetupModal open={isSetupOpen} onOpenChange={setIsSetupOpen} />
    </>
  );
}
