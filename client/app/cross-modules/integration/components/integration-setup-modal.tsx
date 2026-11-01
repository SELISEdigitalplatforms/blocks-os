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
import { useT } from "@seliseblocks/genesis-os";

type IntegrationSetupModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (response: IRunIntegrationSetupResponse) => void;
};

export function IntegrationSetupModal({ open, onOpenChange, onCreated }: Readonly<IntegrationSetupModalProps>) {
  const { t } = useT("os.integration");
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
          <DialogTitle>{t("INTEGRATION_SETUP_MODAL.ADD_CONNECTION")}</DialogTitle>
          <DialogDescription>
            {t("INTEGRATION_SETUP_MODAL.CHOOSE_THE_ACCESS_THIS_CONNECTION")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <section aria-labelledby="integration-access-heading" className="space-y-3">
            <div>
              <h3 id="integration-access-heading" className="text-sm font-medium text-high-emphasis">{t("INTEGRATION_SETUP_MODAL.ACCESS_LEVEL")}</h3>
              <p className="mt-1 text-xs text-medium-emphasis">{t("INTEGRATION_SETUP_MODAL.SELECT_THE_PERMISSIONS_THIS")}</p>
            </div>
            {isLoading ? (
              <div className="flex items-center gap-2 py-5 text-sm text-medium-emphasis" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t("INTEGRATION_SETUP_MODAL.LOADING_ACCESS_OPTIONS")}
              </div>
            ) : isError ? (
              <div className="rounded-md border border-border p-4 text-sm text-medium-emphasis">
                <p>{t("INTEGRATION_SETUP_MODAL.ACCESS_OPTIONS_COULD_NOT_BE")}</p>
                <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void refetch()}>{t("common:RETRY")}</Button>
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
                          {t("INTEGRATION_SETUP_MODAL.PERMISSION", { count: template.permissions.length })}
                        </span>
                      </span>
                      {template.description && <span className="block text-xs leading-relaxed text-medium-emphasis">{template.description}</span>}
                      <span className="flex items-center gap-1.5 text-xs text-medium-emphasis">
                        <Plug className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("INTEGRATION_SETUP_MODAL.ROLE", { roleName: template.roleName })}
                      </span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            ) : (
              <p className="rounded-md border border-border p-4 text-sm text-medium-emphasis">{t("INTEGRATION_SETUP_MODAL.NO_ACCESS_OPTIONS_ARE_AVAILABLE")}</p>
            )}
          </section>
          <div className="space-y-2">
            <label htmlFor="integration-connection-name" className="block text-sm font-medium text-high-emphasis">{t("INTEGRATION_SETUP_MODAL.CONNECTION_NAME")}</label>
            <Input
              id="integration-connection-name"
              value={connectionName}
              onChange={(event) => setConnectionName(event.target.value)}
              placeholder={t("INTEGRATION_SETUP_MODAL.E_G_CONTENT_MANAGEMENT_SYSTEM")}
              maxLength={60}
              autoComplete="off"
              disabled={isPending}
              aria-describedby="integration-connection-name-help"
            />
            <p id="integration-connection-name-help" className="text-xs text-medium-emphasis">{t("INTEGRATION_SETUP_MODAL.USE_A_NAME_THAT_IDENTIFIES")}</p>
          </div>
        </div>
        <DialogFooter className="border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            {t("common:CANCEL")}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!selected || !connectionName.trim() || isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isPending ? t("INTEGRATION_SETUP_MODAL.CREATING") : t("INTEGRATION_SETUP_MODAL.CREATE_CONNECTION")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
