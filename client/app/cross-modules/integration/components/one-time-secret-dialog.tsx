import { Braces } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button/copy-to-clipboard-button";
import { MaskedText } from "@/components/masked-text/masked-text";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { toIntegrationJson } from "@/cross-modules/integration/utils/integration-details";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";

type OneTimeSecretDialogProps = {
  /** The secret to show; null closes the dialog. */
  secret: { clientId: string; clientSecret: string; xBlocksKey?: string; baseUrl?: string; domain?: string } | null;
  onClose: () => void;
};

const copyJson = async (details: NonNullable<OneTimeSecretDialogProps["secret"]>) => {
  try {
    await navigator.clipboard.writeText(
      toIntegrationJson({
        clientId: details.clientId,
        clientSecret: details.clientSecret,
        xBlocksKey: details.xBlocksKey ?? "",
        baseUrl: details.baseUrl ?? "",
        domain: details.domain ?? "",
      }),
    );
    showSuccessToast({ description: "Integration details copied as JSON." });
  } catch {
    showErrorToast({ errors: "Could not copy to the clipboard." });
  }
};

/**
 * Shows a credential's client secret exactly once, after RunSetup or RegenerateSecret.
 * The secret is never written anywhere but the clipboard.
 */
export function OneTimeSecretDialog({ secret, onClose }: Readonly<OneTimeSecretDialogProps>) {
  return (
    <Dialog open={!!secret} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save this secret now</DialogTitle>
          <DialogDescription>
            You won&apos;t see this secret again. Copy it into your app before closing this dialog.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-sm font-medium">Client ID</span>
            <code className="min-w-0 flex-1 truncate font-mono text-sm">{secret?.clientId}</code>
            {secret?.clientId && <CopyToClipboardButton textToCopy={secret.clientId} label="Copy Client ID">{null}</CopyToClipboardButton>}
          </div>
          <div className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-sm font-medium">Client Secret</span>
            <code className="min-w-0 flex-1 truncate font-mono text-sm">
              {secret?.clientSecret ? <MaskedText text={secret.clientSecret} showFirstN={5} length={24} /> : ""}
            </code>
            {secret?.clientSecret && <CopyToClipboardButton textToCopy={secret.clientSecret} label="Copy Client Secret">{null}</CopyToClipboardButton>}
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => secret && copyJson(secret)}
            disabled={!secret?.clientSecret}
          >
            <Braces className="h-4 w-4" />
            <span className="ml-2">Copy as JSON</span>
          </Button>
          <Button type="button" size="sm" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
