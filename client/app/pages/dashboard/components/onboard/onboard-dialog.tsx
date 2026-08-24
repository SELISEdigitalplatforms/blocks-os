import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import type { IProject } from "@seliseblocks/genesis-os/models";
import { showErrorToast, showSuccessToast } from "@seliseblocks/genesis-os/utils";
import { Eye, EyeOff, Rocket } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { CopyButton } from "./copy-button";
import { maskValue, resolveOnboardingGuide, revealKey } from "./onboard-guide";
import { OnboardMarkdown } from "./onboard-markdown";

type OnboardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: IProject;
};

export const OnboardDialog = ({ open, onOpenChange, project }: OnboardDialogProps) => {
  const [isKeyVisible, setIsKeyVisible] = useState(false);

  const tenantId = project?.tenantId ?? "";

  /** Real values — what gets copied, regardless of the mask. */
  const resolved = useMemo(() => resolveOnboardingGuide({ tenantId }), [tenantId]);
  /** What is rendered on screen; identical to `resolved` once the key is revealed. */
  const displayed = useMemo(
    () => (isKeyVisible ? resolved : resolveOnboardingGuide({ tenantId, maskKey: true })),
    [isKeyVisible, resolved, tenantId],
  );

  const realKey = resolved.values.X_BLOCKS_KEY;
  const maskedKey = maskValue(realKey);
  const toCopyText = useCallback(
    (code: string) => revealKey(code, maskedKey, realKey),
    [maskedKey, realKey],
  );

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
          <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-medium-emphasis"
              aria-label={isKeyVisible ? "Hide project key" : "Show project key"}
              title="The key is masked on screen only — copying always includes the real value."
              onClick={() => setIsKeyVisible((visible) => !visible)}
            >
              {isKeyVisible ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
              {isKeyVisible ? "Hide key" : "Show key"}
            </Button>
          </div>

          <OnboardMarkdown markdown={displayed.markdown} toCopyText={toCopyText} />
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
