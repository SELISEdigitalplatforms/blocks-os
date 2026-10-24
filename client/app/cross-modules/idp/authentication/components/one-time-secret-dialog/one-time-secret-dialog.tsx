import { Button } from "@/components/ui-kits/button/button";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button/copy-to-clipboard-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";

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
  return (
    <Dialog open={!!secret} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-lg"
        hideCloseButton
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Copy your client secret now</DialogTitle>
          <DialogDescription>
            {secret?.reason === "rotated" ? (
              <>
                The secret for <strong>{secret.label}</strong> was rotated. The old secret no longer
                works.{" "}
              </>
            ) : (
              <>
                <strong>{secret?.label}</strong> was created.{" "}
              </>
            )}
            You will not see this secret again. Copy it and store it somewhere safe before you close
            this dialog. If you lose it, rotate the secret to get a new one.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <span className="text-sm font-medium">Client ID</span>
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
              <code className="min-w-0 flex-1 break-all font-mono text-sm">{secret?.clientId}</code>
              {secret?.clientId && (
                <CopyToClipboardButton textToCopy={secret.clientId} label="Copy client ID">
                  {null}
                </CopyToClipboardButton>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-sm font-medium">Client Secret</span>
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
              <code className="min-w-0 flex-1 break-all font-mono text-sm">
                {secret?.clientSecret}
              </code>
              {secret?.clientSecret && (
                <CopyToClipboardButton textToCopy={secret.clientSecret} label="Copy client secret">
                  {null}
                </CopyToClipboardButton>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" size="sm" onClick={onClose}>
            I copied it, close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
