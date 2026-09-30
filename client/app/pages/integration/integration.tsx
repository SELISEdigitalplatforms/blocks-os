import { Loader2, Plug, RotateCw } from "lucide-react";
import { useState } from "react";
import { Banner } from "@/components/ui-kits/banner/banner";
import { Button } from "@/components/ui-kits/button/button";
import { IntegrationConnectionList } from "@/cross-modules/integration/components/integration-connection-list";
import { IntegrationSetupModal } from "@/cross-modules/integration/components/integration-setup-modal";
import { OneTimeSecretDialog } from "@/cross-modules/integration/components/one-time-secret-dialog";
import {
  useIntegrationConnections,
  useDisconnect, useRegenerateSecret,
} from "@/cross-modules/integration/hooks/use-integration";
import { IRunIntegrationSetupResponse } from "@/cross-modules/integration/models/integration.model";

export default function IntegrationPage() {
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [secret, setSecret] = useState<IRunIntegrationSetupResponse | null>(null);
  const { mutate: disconnect, isPending: disconnecting } = useDisconnect();
  const { mutate: regenerate, isPending: regenerating } = useRegenerateSecret();
  const {
    data: connections = [], isLoading, isError, refetch, isFetching,
  } = useIntegrationConnections();

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-medium-emphasis" />
      </div>
    );
  }

  // Without the record the page cannot tell whether setup already ran, so it must not offer
  // Setup: running it again would reach the save step and be refused as already configured.
  if (isError) {
    return (
      <Banner variant="destructive" title="Could not load Integration setup" compact={false}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>Check your connection and try again.</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RotateCw className="h-4 w-4" />
            <span className="ml-2">Retry</span>
          </Button>
        </div>
      </Banner>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Plug className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium">Integrations</p>
            <p className="text-xs text-medium-emphasis">{connections.length} connection{connections.length === 1 ? "" : "s"}</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setIsSetupOpen(true)}>Add connection</Button>
      </div>

      {connections.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-6 py-10 text-center">
          <h2 className="text-base font-semibold">No integrations yet</h2>
          <p className="mt-1 text-sm text-medium-emphasis">
            Add a connection to create its role and client credential.
          </p>
        </div>
      ) : (
        <IntegrationConnectionList
          connections={connections}
          onDisconnect={(connectionId) => disconnect(connectionId)}
          onRegenerate={(connection) =>
            regenerate(connection.itemId, {
              onSuccess: (r) =>
                r.clientSecret &&
                setSecret({ isSuccess: true, clientSecret: r.clientSecret, clientId: connection.clientCredentialId }),
            })
          }
          disconnecting={disconnecting}
          regenerating={regenerating}
        />
      )}

      <IntegrationSetupModal open={isSetupOpen} onOpenChange={setIsSetupOpen} onCreated={setSecret} />
      <OneTimeSecretDialog
        secret={secret ? { clientId: secret.clientId ?? "", clientSecret: secret.clientSecret ?? "", xBlocksKey: secret.xBlocksKey, baseUrl: secret.baseUrl } : null}
        onClose={() => setSecret(null)}
      />
    </div>
  );
}
