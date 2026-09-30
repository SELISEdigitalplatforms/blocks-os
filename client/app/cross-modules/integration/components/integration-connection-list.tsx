import { useState } from "react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { formatDate } from "@/lib/utils";
import { IIntegrationConnection } from "@/cross-modules/integration/models/integration.model";

type PendingAction = { type: "disconnect" | "regenerate"; connection: IIntegrationConnection };

type IntegrationConnectionListProps = {
  connections: IIntegrationConnection[];
  onDisconnect: (connectionId: string) => void;
  /** Receives the whole connection: the rotate response carries only the new secret, so the dialog needs the row's client id. */
  onRegenerate: (connection: IIntegrationConnection) => void;
  disconnecting: boolean;
  regenerating: boolean;
};

const accessLevelLabel = (connection: IIntegrationConnection): string => {
  if (connection.templateAccessLevel === "read") return "Read";
  if (connection.templateAccessLevel === "full") return "Full";
  return connection.templateAccessLevel || "—";
};

const sourceLabel = (connection: IIntegrationConnection): string =>
  connection.source === "connect" ? "Connect flow" : "Manual";

/** The environment's integration connections, with Disconnect and Regenerate behind confirm dialogs. */
export function IntegrationConnectionList({
  connections,
  onDisconnect,
  onRegenerate,
  disconnecting,
  regenerating,
}: Readonly<IntegrationConnectionListProps>) {
  const [pending, setPending] = useState<PendingAction | null>(null);

  const closeConfirm = () => setPending(null);
  const confirmPending = () => {
    if (!pending) return;
    if (pending.type === "disconnect") onDisconnect(pending.connection.itemId);
    else onRegenerate(pending.connection);
    setPending(null);
  };

  return (
    <>
      <div className="space-y-2">
        {connections.map((connection) => (
          <div
            key={connection.itemId}
            data-testid="integration-connection-row"
            className="flex items-center justify-between gap-3 rounded-lg border border-border p-4"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{connection.connectionName}</p>
                <Badge variant="outline">{accessLevelLabel(connection)}</Badge>
                <Badge variant={connection.status === "active" ? "success" : "secondary"}>
                  {connection.status}
                </Badge>
                {connection.neverDelivered && <Badge variant="secondary">Never delivered</Badge>}
                <Badge variant="outline">{sourceLabel(connection)}</Badge>
              </div>
              <p className="mt-1 truncate text-xs text-medium-emphasis">
                {connection.templateDisplayName} · Client ID {connection.clientCredentialId}
                {connection.siteUrl ? ` · ${connection.siteUrl}` : ""}
              </p>
              {connection.createdDate && (
                <p className="mt-0.5 text-xs text-medium-emphasis">
                  Created {formatDate(new Date(connection.createdDate), true)}
                  {connection.createdBy ? ` by ${connection.createdBy}` : ""}
                </p>
              )}
            </div>
            {connection.status === "active" && (
              <div className="flex flex-shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={regenerating}
                  onClick={() => setPending({ type: "regenerate", connection })}
                >
                  Regenerate
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={disconnecting}
                  onClick={() => setPending({ type: "disconnect", connection })}
                >
                  Disconnect
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
      <Dialog open={!!pending} onOpenChange={(open) => !open && closeConfirm()}>
        {pending && (
          <ConfirmationModal
            onCancel={closeConfirm}
            onConfirm={confirmPending}
            buttonState={{ confirm: { disable: pending.type === "disconnect" ? disconnecting : regenerating } }}
            data={{
              dialogTitle:
                pending.type === "disconnect" ? "Disconnect this connection?" : "Regenerate the secret?",
              dialogSubtitle:
                pending.type === "disconnect" ? (
                  <>
                    <p>
                      <span className="font-medium">{pending.connection.connectionName}</span> will stop working
                      immediately and its client credential will be deleted.
                    </p>
                    <p>This cannot be undone; you can always create a new connection.</p>
                    <p>Access tokens already issued stay valid until they expire (up to 60 minutes).</p>
                  </>
                ) : (
                  <>
                    <p>
                      A new secret will be created for{" "}
                      <span className="font-medium">{pending.connection.connectionName}</span>. The client id stays
                      the same.
                    </p>
                    <p>The old secret stops working immediately; update your site with the new one.</p>
                    <p>Access tokens already issued stay valid until they expire (up to 60 minutes).</p>
                  </>
                ),
              confirmButton: pending.type === "disconnect" ? "Disconnect" : "Regenerate",
              cancelButton: "Cancel",
            }}
          />
        )}
      </Dialog>
    </>
  );
}
