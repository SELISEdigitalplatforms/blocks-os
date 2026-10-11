import { Loader2, Plug } from "lucide-react";
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
  const { data: templates = [], isLoading, isError, refetch } = useIntegrationTemplates(open);
  const { mutate: runSetup, isPending } = useRunIntegrationSetup();

  const selected = templates.find((t) => t.key === templateKey);

  const close = () => {
    setTemplateKey("");
    setConnectionName("");
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    // Setup is a sequence of IAM calls; closing mid-way would hide which step it stopped at.
    if (isPending) return;
    if (next) onOpenChange(true);
    else close();
  };

  const handleConfirm = () => {
    if (!selected || !connectionName.trim() || isPending) return;
    runSetup({ templateKey: selected.key, connectionName: connectionName.trim() }, {
      onSuccess: (response) => {
        if (response.clientSecret) onCreated?.(response);
        close();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" hideCloseButton={isPending}>
        <DialogHeader>
          <DialogTitle>Add connection</DialogTitle>
          <DialogDescription>
            Choose the access this connection needs. Blocks OS will create a dedicated role and client credential.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <section aria-labelledby="integration-access-heading" className="space-y-3">
            <div>
              <h3 id="integration-access-heading" className="text-sm font-medium text-high-emphasis">Access level</h3>
              <p className="mt-1 text-xs text-medium-emphasis">Select the permissions this connection will use.</p>
            </div>
            {isLoading ? (
              <div className="flex items-center gap-2 py-5 text-sm text-medium-emphasis" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading access options…
              </div>
            ) : isError ? (
              <div className="rounded-md border border-border p-4 text-sm text-medium-emphasis">
                <p>Access options could not be loaded.</p>
                <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void refetch()}>Retry</Button>
              </div>
            ) : templates.length > 0 ? (
              <RadioGroup value={templateKey} onValueChange={setTemplateKey} aria-labelledby="integration-access-heading">
                {templates.map((template) => (
                  <label
                    key={template.key}
                    htmlFor={`integration-template-${template.key}`}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                      templateKey === template.key
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background hover:border-primary/50 hover:bg-accent/40"
                    } ${isPending ? "pointer-events-none opacity-60" : ""}`}
                  >
                    <RadioGroupItem
                      id={`integration-template-${template.key}`}
                      value={template.key}
                      className="mt-1 shrink-0"
                      disabled={isPending}
                    />
                    <span className="min-w-0 flex-1 space-y-2">
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-high-emphasis">{template.displayName}</span>
                        <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs text-medium-emphasis">
                          {template.permissions.length} permission{template.permissions.length === 1 ? "" : "s"}
                        </span>
                      </span>
                      {template.description && <span className="block text-xs leading-relaxed text-medium-emphasis">{template.description}</span>}
                      <span className="flex items-center gap-1.5 text-xs text-medium-emphasis">
                        <Plug className="h-3.5 w-3.5" aria-hidden="true" />
                        Role: {template.roleName}
                      </span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            ) : (
              <p className="rounded-md border border-border p-4 text-sm text-medium-emphasis">No access options are available for this environment.</p>
            )}
          </section>
          <div className="space-y-2">
            <label htmlFor="integration-connection-name" className="block text-sm font-medium text-high-emphasis">Connection name</label>
            <Input
              id="integration-connection-name"
              value={connectionName}
              onChange={(event) => setConnectionName(event.target.value)}
              placeholder="e.g. Content management system"
              maxLength={60}
              autoComplete="off"
              disabled={isPending}
              aria-describedby="integration-connection-name-help"
            />
            <p id="integration-connection-name-help" className="text-xs text-medium-emphasis">Use a name that identifies the application or service.</p>
          </div>
        </div>
        <DialogFooter className="border-t border-border pt-4">
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
            {isPending ? "Creating…" : "Create connection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
