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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Cancel {sourceType.toLowerCase()} trace request?</DialogTitle>
          <DialogDescription>
            This stops the retrieval that is currently running.
          </DialogDescription>
        </DialogHeader>

        <Banner variant="warning" title="This cannot be undone">
          Any traces and logs restored so far will be discarded. You can submit a new request
          straight away.
        </Banner>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Keep Running
          </Button>
          <Button variant="destructive" onClick={() => void onConfirm()} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cancelling
              </>
            ) : (
              "Cancel Request"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
