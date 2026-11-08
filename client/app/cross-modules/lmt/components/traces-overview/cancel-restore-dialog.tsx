import React from "react";
import { Banner } from "@/components/ui-kits/banner/banner";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { TRACE_REQUEST_SOURCE_TYPE } from "@blocks-lmt/constants/trace.constant";
import { Loader2 } from "lucide-react";
import { useT } from "@seliseblocks/genesis-os";

interface CancelRestoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceType: TRACE_REQUEST_SOURCE_TYPE;
  isPending: boolean;
  onConfirm: () => Promise<void>;
}

/**
 * Confirms cancelling an in-flight restore. Cancelling discards whatever has been restored so far,
 * so the wording has to be explicit — the user cannot get the partial data back afterwards.
 */
export function CancelRestoreDialog({
  open,
  onOpenChange,
  sourceType,
  isPending,
  onConfirm,
}: CancelRestoreDialogProps) {
  const { t } = useT("os.lmt");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>
            {t("CANCEL_RESTORE_DIALOG.CANCEL_TRACE_REQUEST", { value1: sourceType.toLowerCase() })}
          </DialogTitle>
          <DialogDescription>
            {t("CANCEL_RESTORE_DIALOG.THIS_STOPS_THE_RETRIEVAL_THAT")}
          </DialogDescription>
        </DialogHeader>

        <Banner variant="warning" title={t("CANCEL_RESTORE_DIALOG.THIS_CANNOT_BE_UNDONE")}>
          {t("CANCEL_RESTORE_DIALOG.ANY_TRACES_AND_LOGS_RESTORED")}
        </Banner>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t("CANCEL_RESTORE_DIALOG.KEEP_RUNNING")}
          </Button>
          <Button variant="destructive" onClick={() => void onConfirm()} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("CANCEL_RESTORE_DIALOG.CANCELLING")}
              </>
            ) : (
              t("CANCEL_RESTORE_DIALOG.CANCEL_REQUEST")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
