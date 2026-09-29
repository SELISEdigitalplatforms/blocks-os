import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { useIntegrationTemplates, useRunIntegrationSetup } from "@/cross-modules/integration/hooks/use-integration";
import {
  INTEGRATION_SETUP_STEP_LABELS,
  IntegrationSetupStep,
} from "@/cross-modules/integration/services/integration-setup.runner";

type IntegrationSetupModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function IntegrationSetupModal({ open, onOpenChange }: Readonly<IntegrationSetupModalProps>) {
  const [templateKey, setTemplateKey] = useState("");
  const [currentStep, setCurrentStep] = useState<IntegrationSetupStep | null>(null);
  const { data: templates = [], isLoading } = useIntegrationTemplates(open);
  const { mutate: runSetup, isPending } = useRunIntegrationSetup(setCurrentStep);

  const selected = templates.find((t) => t.key === templateKey);

  // Only one template is offered today, so it's preselected rather than left for the user to pick.
  useEffect(() => {
    if (!templateKey && templates.length > 0) {
      setTemplateKey(templates[0].key);
    }
  }, [templateKey, templates]);

  const handleOpenChange = (next: boolean) => {
    // Setup is a sequence of IAM calls; closing mid-way would hide which step it stopped at.
    if (isPending) return;
    if (!next) {
      setTemplateKey("");
      setCurrentStep(null);
    }
    onOpenChange(next);
  };

  const handleConfirm = () => {
    if (!selected) return;
    runSetup(selected, {
      onSuccess: () => handleOpenChange(false),
      onSettled: () => setCurrentStep(null),
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set up Integration</DialogTitle>
          <DialogDescription>
            Creates a role with the service&apos;s permissions and a client credential for it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {isLoading ? (
            <p className="text-xs text-medium-emphasis">Loading...</p>
          ) : selected ? (
            <Badge variant="secondary" className="w-fit">
              {selected.displayName}
            </Badge>
          ) : (
            <p className="text-xs text-medium-emphasis">No Integration templates are available.</p>
          )}
          {selected && (
            <div className="space-y-1 rounded-md border border-border p-3 text-xs text-medium-emphasis">
              {selected.description && <p>{selected.description}</p>}
              <p>
                Role <span className="font-medium text-high-emphasis">{selected.roleName}</span>{" "}
                with {selected.permissions.length} permissions.
              </p>
            </div>
          )}
          {isPending && currentStep && (
            <p className="flex items-center gap-2 text-xs text-medium-emphasis">
              <Loader2 className="h-3 w-3 animate-spin" />
              {INTEGRATION_SETUP_STEP_LABELS[currentStep]}...
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!selected || isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
