import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import type { IProject } from "@seliseblocks/genesis-os/models";
import { showErrorToast, showSuccessToast } from "@seliseblocks/genesis-os/utils";
import { Rocket } from "lucide-react";
import { useMemo } from "react";
import { CopyButton } from "./copy-button";
import { resolveOnboardingGuide } from "./onboard-guide";
import { OnboardMarkdown } from "./onboard-markdown";

type OnboardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: IProject;
};

export const OnboardDialog = ({ open, onOpenChange, project }: OnboardDialogProps) => {
  const tenantId = project?.tenantId ?? "";

  const resolved = useMemo(() => resolveOnboardingGuide({ tenantId }), [tenantId]);

  const handleCopied = (succeeded: boolean) => {
    if (succeeded) {
      showSuccessToast({
        title: "Instructions copied",
        description: "Paste them into your coding agent to start building.",
      });
      return;
    }
    showErrorToast({ errors: { clipboard: "Could not copy the instructions." } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="space-y-1.5 border-b border-border-default px-6 py-5 text-left">
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" aria-hidden="true" />
            Bootstrap with an AI agent
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <OnboardMarkdown markdown={resolved.markdown} />
        </div>

        <DialogFooter className="items-center border-t border-border-default px-6 py-4 sm:justify-end">
          <CopyButton
            text={resolved.markdown}
            label="Copy instructions"
            showLabel
            variant="default"
            onCopied={handleCopied}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
