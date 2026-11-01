import { Button } from "@/components/ui-kits/button/button";
import { maskId } from "../../utils/mask-id.util";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button/copy-to-clipboard-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { useT } from "@seliseblocks/genesis-os";

export type OneTimeSecret = {
  /** Name shown in the description, e.g. the client's display name. */
  label: string;
  clientId: string;
  clientSecret: string;
  /** "created" for a new client, "rotated" after a secret rotation. */
  reason: "created" | "rotated";
};

type OneTimeSecretDialogProps = {
  /** The secret to show; null closes the dialog. */
  secret: OneTimeSecret | null;
  onClose: () => void;
};

/**
 * Shows a client secret exactly once, right after the client is created or its secret rotated.
 * The list and detail APIs never return the secret, so this is the only time it can be copied.
 * Clicking outside or pressing Escape does not close it; only Done does.
 */
export function OneTimeSecretDialog({ secret, onClose }: Readonly<OneTimeSecretDialogProps>) {
  const { t } = useT("os.idp.auth");
  return (
    <Dialog open={!!secret} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-lg"
        hideCloseButton
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("ONE_TIME_SECRET_DIALOG.TITLE")}</DialogTitle>
          <DialogDescription>
            {secret?.reason === "rotated"
              ? t("ONE_TIME_SECRET_DIALOG.ROTATED_DESCRIPTION", { name: secret.label })
              : t("ONE_TIME_SECRET_DIALOG.CREATED_DESCRIPTION", { name: secret?.label ?? "" })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <span className="text-sm font-medium">{t("ONE_TIME_SECRET_DIALOG.CLIENT_ID")}</span>
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
              <code className="min-w-0 flex-1 break-all font-mono text-sm">
                {maskId(secret?.clientId)}
              </code>
              {secret?.clientId && (
                <CopyToClipboardButton textToCopy={secret.clientId} label={t("ONE_TIME_SECRET_DIALOG.COPY_CLIENT_ID")}>
                  {null}
                </CopyToClipboardButton>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-sm font-medium">{t("ONE_TIME_SECRET_DIALOG.CLIENT_SECRET")}</span>
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
              <code className="min-w-0 flex-1 break-all font-mono text-sm">
                {secret?.clientSecret}
              </code>
              {secret?.clientSecret && (
                <CopyToClipboardButton textToCopy={secret.clientSecret} label={t("ONE_TIME_SECRET_DIALOG.COPY_CLIENT_SECRET")}>
                  {null}
                </CopyToClipboardButton>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" size="sm" onClick={onClose}>
            {t("ONE_TIME_SECRET_DIALOG.CLOSE")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
