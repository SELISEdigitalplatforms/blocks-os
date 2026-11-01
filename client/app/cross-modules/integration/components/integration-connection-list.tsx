import { useState, type ReactNode } from "react";
import { Braces } from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { checkValidDate, formatFullDate } from "@/lib/utils";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { IIntegrationConnection } from "@/cross-modules/integration/models/integration.model";
import { useT, tStatic } from "@seliseblocks/genesis-os";

const I18N_MODULE = "os.integration";

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
  connection.source === "connect"
    ? tStatic(I18N_MODULE, "INTEGRATION_CONNECTION_LIST.CONNECT_FLOW")
    : "Manual";

/** Saved connections contain metadata, not the one-time client secret. */
export const toConnectionJson = (connection: IIntegrationConnection): string =>
  JSON.stringify(
    {
      connectionId: connection.itemId,
      connectionName: connection.connectionName,
      templateKey: connection.templateKey,
      templateDisplayName: connection.templateDisplayName,
      accessLevel: connection.templateAccessLevel,
      status: connection.status,
      source: connection.source,
      clientCredentialId: connection.clientCredentialId,
      roleId: connection.roleId,
      roleSlug: connection.roleSlug,
      siteUrl: connection.siteUrl ?? null,
      createdDate: connection.createdDate,
      createdBy: connection.createdBy ?? null,
      neverDelivered: connection.neverDelivered ?? false,
    },
    null,
    2,
  );

const copyConnectionJson = async (connection: IIntegrationConnection) => {
  try {
    await navigator.clipboard.writeText(toConnectionJson(connection));
    showSuccessToast({
      description: tStatic(
        I18N_MODULE,
        "INTEGRATION_CONNECTION_LIST.CONNECTION_DETAILS_COPIED_AS_JSON",
      ),
    });
  } catch {
    showErrorToast({
      errors: tStatic(I18N_MODULE, "INTEGRATION_CONNECTION_LIST.COULD_NOT_COPY_TO_THE"),
    });
  }
};

function Detail({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-xs font-medium text-medium-emphasis">{label}</dt>
      <dd className="wrap-break-word text-sm text-high-emphasis">{children}</dd>
    </div>
  );
}

/** The environment's integration connections, with Disconnect and Regenerate behind confirm dialogs. */
export function IntegrationConnectionList({
  connections,
  onDisconnect,
  onRegenerate,
  disconnecting,
  regenerating,
}: Readonly<IntegrationConnectionListProps>) {
  const { t } = useT(I18N_MODULE);
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
      <div className="space-y-3">
        {connections.map((connection) => (
          <article
            key={connection.itemId}
            data-testid="integration-connection-row"
            className="overflow-hidden rounded-lg border border-border bg-card"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
              <div className="min-w-0 space-y-2">
                <h3 className="wrap-break-word text-base font-semibold text-high-emphasis">
                  {connection.connectionName}
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={connection.status === "active" ? "success" : "secondary"}>
                    {connection.status}
                  </Badge>
                  <Badge variant="outline">
                    {t("INTEGRATION_CONNECTION_LIST.ACCESS", {
                      connection: accessLevelLabel(connection),
                    })}
                  </Badge>
                  <Badge variant="outline">{sourceLabel(connection)}</Badge>
                  {connection.neverDelivered && (
                    <Badge variant="secondary">
                      {t("INTEGRATION_CONNECTION_LIST.NEVER_DELIVERED")}
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => void copyConnectionJson(connection)}
              >
                <Braces className="h-4 w-4" aria-hidden="true" />
                {t("INTEGRATION_CONNECTION_LIST.COPY_AS_JSON")}
              </Button>
            </div>
            <dl className="grid gap-x-8 gap-y-4 border-t border-border px-5 py-4 sm:grid-cols-2 xl:grid-cols-3">
              <Detail label={t("INTEGRATION_CONNECTION_LIST.INTEGRATION")}>
                {connection.templateDisplayName}
              </Detail>
              <Detail label={t("INTEGRATION_CONNECTION_LIST.CLIENT_ID")}>
                <code className="break-all font-mono text-xs">{connection.clientCredentialId}</code>
              </Detail>
              <Detail label={t("INTEGRATION_CONNECTION_LIST.SITE_URL")}>
                {connection.siteUrl ? <span className="break-all">{connection.siteUrl}</span> : "—"}
              </Detail>
              <Detail label={t("INTEGRATION_CONNECTION_LIST.CREATED")}>
                {connection.createdDate && checkValidDate(connection.createdDate) ? (
                  <time dateTime={connection.createdDate}>
                    {formatFullDate(new Date(connection.createdDate))}
                  </time>
                ) : (
                  "—"
                )}
              </Detail>
              <Detail label={t("INTEGRATION_CONNECTION_LIST.CREATED_BY")}>
                {connection.createdBy || "—"}
              </Detail>
            </dl>
            {connection.status === "active" && (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background/40 px-5 py-3">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={regenerating}
                  onClick={() => setPending({ type: "regenerate", connection })}
                >
                  {t("INTEGRATION_CONNECTION_LIST.REGENERATE")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={disconnecting}
                  onClick={() => setPending({ type: "disconnect", connection })}
                >
                  {t("INTEGRATION_CONNECTION_LIST.DISCONNECT")}
                </Button>
              </div>
            )}
          </article>
        ))}
      </div>
      <Dialog open={!!pending} onOpenChange={(open) => !open && closeConfirm()}>
        {pending && (
          <ConfirmationModal
            onCancel={closeConfirm}
            onConfirm={confirmPending}
            buttonState={{
              confirm: { disable: pending.type === "disconnect" ? disconnecting : regenerating },
            }}
            data={{
              dialogTitle:
                pending.type === "disconnect"
                  ? t("INTEGRATION_CONNECTION_LIST.DISCONNECT_THIS_CONNECTION")
                  : t("INTEGRATION_CONNECTION_LIST.REGENERATE_THE_SECRET"),
              dialogSubtitle:
                pending.type === "disconnect" ? (
                  <>
                    <p>
                      {t("INTEGRATION_CONNECTION_LIST.WILL_STOP_WORKING_IMMEDIATELY_AND", {
                        span: `${pending.connection.connectionName}`,
                      })}
                    </p>
                    <p>{t("INTEGRATION_CONNECTION_LIST.THIS_CANNOT_BE_UNDONE_YOU")}</p>
                    <p>{t("INTEGRATION_CONNECTION_LIST.ACCESS_TOKENS_ALREADY_ISSUED_STAY")}</p>
                  </>
                ) : (
                  <>
                    <p>
                      {t("INTEGRATION_CONNECTION_LIST.A_NEW_SECRET_WILL_BE", {
                        span: `${pending.connection.connectionName}`,
                      })}
                    </p>
                    <p>{t("INTEGRATION_CONNECTION_LIST.THE_OLD_SECRET_STOPS_WORKING")}</p>
                    <p>{t("INTEGRATION_CONNECTION_LIST.ACCESS_TOKENS_ALREADY_ISSUED_STAY")}</p>
                  </>
                ),
              confirmButton:
                pending.type === "disconnect"
                  ? t("INTEGRATION_CONNECTION_LIST.DISCONNECT")
                  : t("INTEGRATION_CONNECTION_LIST.REGENERATE"),
              cancelButton: t("common:CANCEL"),
            }}
          />
        )}
      </Dialog>
    </>
  );
}
