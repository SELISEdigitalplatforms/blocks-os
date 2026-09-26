import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { Label } from "@/components/ui-kits/label/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { useConnectTemplates, useRunConnectSetup } from "@/cross-modules/connect/hooks/use-connect";
import {
  CONNECT_SETUP_STEP_LABELS,
  ConnectSetupStep,
} from "@/cross-modules/connect/services/connect-setup.runner";

type ConnectSetupModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ConnectSetupModal({ open, onOpenChange }: Readonly<ConnectSetupModalProps>) {
  const [templateKey, setTemplateKey] = useState("");
  const [currentStep, setCurrentStep] = useState<ConnectSetupStep | null>(null);
  const { data: templates = [], isLoading } = useConnectTemplates(open);
  const { mutate: runSetup, isPending } = useRunConnectSetup(setCurrentStep);

  const selected = templates.find((t) => t.key === templateKey);

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
          <DialogTitle>Set up Connect</DialogTitle>
          <DialogDescription>
            Creates a role with the service&apos;s permissions and a client credential for it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="connect-template">Localization</Label>
          <Select value={templateKey} onValueChange={setTemplateKey} disabled={isPending}>
            <SelectTrigger id="connect-template">
              <SelectValue placeholder={isLoading ? "Loading..." : "Select localization"} />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.key} value={template.key}>
                  {template.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!isLoading && templates.length === 0 && (
            <p className="text-xs text-medium-emphasis">No Connect templates are available.</p>
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
              {CONNECT_SETUP_STEP_LABELS[currentStep]}...
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
