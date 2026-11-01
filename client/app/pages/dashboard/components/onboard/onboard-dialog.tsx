import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import type { IProject } from "@/models/project.model";
import { showErrorToast, showSuccessToast } from "@seliseblocks/genesis-os/utils";
import { Rocket } from "lucide-react";
import { useMemo } from "react";
import { CopyButton } from "./copy-button";
import { resolveOnboardingGuide } from "./onboard-guide";
import { OnboardMarkdown } from "./onboard-markdown";
import { useT, tStatic } from "@seliseblocks/genesis-os";

type OnboardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: IProject;
};

export const OnboardDialog = ({ open, onOpenChange, project }: OnboardDialogProps) => {
  const { t } = useT("os.dashboard");
  const tenantId = project?.tenantId ?? "";

  const resolved = useMemo(() => resolveOnboardingGuide({ tenantId }), [tenantId]);

  const handleCopied = (succeeded: boolean) => {
    if (succeeded) {
      showSuccessToast({
        title: t("ONBOARD_DIALOG.INSTRUCTIONS_COPIED"),
        description: t("ONBOARD_DIALOG.PASTE_THEM_INTO_YOUR_CODING"),
      });
      return;
    }
    showErrorToast({ errors: { clipboard: tStatic("os.dashboard", "ONBOARD_DIALOG.COULD_NOT_COPY_THE_INSTRUCTIONS") } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="space-y-1.5 border-b border-border-default px-6 py-5 text-left">
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" aria-hidden="true" />
            {t("ONBOARD_DIALOG.BOOTSTRAP_WITH_AN_AI_AGENT")}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <OnboardMarkdown markdown={resolved.markdown} />
        </div>

        <DialogFooter className="items-center border-t border-border-default px-6 py-4 sm:justify-end">
          <CopyButton
            text={resolved.markdown}
            label={t("ONBOARD_DIALOG.COPY_INSTRUCTIONS")}
            showLabel
            variant="default"
            onCopied={handleCopied}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
