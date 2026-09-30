import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui-kits/button/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui-kits/radio-group/radio-group";
import { Input } from "@/components/ui-kits/input/input";
import { IRunIntegrationSetupResponse } from "@/cross-modules/integration/models/integration.model";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { useIntegrationTemplates, useRunIntegrationSetup } from "@/cross-modules/integration/hooks/use-integration";

type IntegrationSetupModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (response: IRunIntegrationSetupResponse) => void;
};

export function IntegrationSetupModal({ open, onOpenChange, onCreated }: Readonly<IntegrationSetupModalProps>) {
  const [templateKey, setTemplateKey] = useState("");
  const [connectionName, setConnectionName] = useState("");
  const { data: templates = [], isLoading } = useIntegrationTemplates(open);
  const { mutate: runSetup, isPending } = useRunIntegrationSetup();

  const selected = templates.find((t) => t.key === templateKey);

  const handleOpenChange = (next: boolean) => {
    // Setup is a sequence of IAM calls; closing mid-way would hide which step it stopped at.
    if (isPending) return;
    if (!next) {
      setTemplateKey("");
      setConnectionName("");
    }
    onOpenChange(next);
  };

  const handleConfirm = () => {
    if (!selected) return;
    runSetup({ templateKey: selected.key, connectionName }, {
      onSuccess: (response) => { if (response.clientSecret) onCreated?.(response); handleOpenChange(false); },
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
          ) : templates.length > 0 ? (
            <RadioGroup value={templateKey} onValueChange={setTemplateKey}>
              {templates.map((template) => (
                <label
                  key={template.key}
                  htmlFor={`integration-template-${template.key}`}
                  className="flex cursor-pointer gap-3 rounded-md border border-border p-3 text-xs"
                >
                  <RadioGroupItem
                    id={`integration-template-${template.key}`}
                    value={template.key}
                    className="mt-0.5"
                  />
                  <span className="space-y-1">
                    <span className="block font-medium text-high-emphasis">{template.displayName}</span>
                    {template.description && <span className="block text-medium-emphasis">{template.description}</span>}
                    <span className="block text-medium-emphasis">
                      Role {template.roleName} with {template.permissions.length} permissions.
                    </span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          ) : (
            <p className="text-xs text-medium-emphasis">No Integration templates are available.</p>
          )}
          <Input value={connectionName} onChange={(event) => setConnectionName(event.target.value)} placeholder="Connection name" maxLength={60} />
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
          <Button type="button" onClick={handleConfirm} disabled={!selected || !connectionName.trim() || isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
