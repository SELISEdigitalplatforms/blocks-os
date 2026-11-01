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
import { useT, tStatic } from "@seliseblocks/genesis-os";

const I18N_MODULE = "os.integration";

type OneTimeSecretDialogProps = {
  /** The secret to show; null closes the dialog. */
  secret: {
    clientId: string;
    clientSecret: string;
    xBlocksKey?: string;
    baseUrl?: string;
    domain?: string;
  } | null;
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
    showSuccessToast({
      description: tStatic(
        I18N_MODULE,
        "ONE_TIME_SECRET_DIALOG.INTEGRATION_DETAILS_COPIED_AS_JSON",
      ),
    });
  } catch {
    showErrorToast({
      errors: tStatic(I18N_MODULE, "ONE_TIME_SECRET_DIALOG.COULD_NOT_COPY_TO_THE"),
    });
  }
};

/**
 * Shows a credential's client secret exactly once, after RunSetup or RegenerateSecret.
 * The secret is never written anywhere but the clipboard.
 */
export function OneTimeSecretDialog({ secret, onClose }: Readonly<OneTimeSecretDialogProps>) {
  const { t } = useT(I18N_MODULE);
  return (
    <Dialog open={!!secret} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("ONE_TIME_SECRET_DIALOG.SAVE_THIS_SECRET_NOW")}</DialogTitle>
          <DialogDescription>{t("ONE_TIME_SECRET_DIALOG.YOU_WON_T_SEE_THIS")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-sm font-medium">
              {t("ONE_TIME_SECRET_DIALOG.CLIENT_ID")}
            </span>
            <code className="min-w-0 flex-1 truncate font-mono text-sm">{secret?.clientId}</code>
            {secret?.clientId && (
              <CopyToClipboardButton
                textToCopy={secret.clientId}
                label={t("ONE_TIME_SECRET_DIALOG.COPY_CLIENT_ID")}
              >
                {null}
              </CopyToClipboardButton>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-sm font-medium">
              {t("ONE_TIME_SECRET_DIALOG.CLIENT_SECRET")}
            </span>
            <code className="min-w-0 flex-1 truncate font-mono text-sm">
              {secret?.clientSecret ? (
                <MaskedText text={secret.clientSecret} showFirstN={5} length={24} />
              ) : (
                ""
              )}
            </code>
            {secret?.clientSecret && (
              <CopyToClipboardButton
                textToCopy={secret.clientSecret}
                label={t("ONE_TIME_SECRET_DIALOG.COPY_CLIENT_SECRET")}
              >
                {null}
              </CopyToClipboardButton>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="whitespace-nowrap"
            onClick={() => secret && copyJson(secret)}
            disabled={!secret?.clientSecret}
          >
            <Braces className="h-4 w-4" />
            <span className="ml-2">{t("ONE_TIME_SECRET_DIALOG.COPY_AS_JSON")}</span>
          </Button>
          <Button type="button" size="sm" className="whitespace-nowrap" onClick={onClose}>
            {t("common:DONE")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
