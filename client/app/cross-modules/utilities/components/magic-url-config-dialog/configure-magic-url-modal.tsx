import React, { ReactNode, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import { Button } from "@/components/ui-kits/button/button";
import { Input } from "@/components/ui-kits/input/input";
import { Label } from "@/components/ui-kits/label/label";
import { useSaveMagicUrlConfig } from "@blocks-utilities/hooks/use-magic-url-config";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { getDefaultShortUrlBase, isValidUrl } from "@blocks-utilities/utils/url.util";
import { useProjectStore, useT, tStatic } from "@seliseblocks/genesis-os";
import { IMagicUrlConfig } from "@blocks-utilities/models/magic-url-config.model";
import { v4 as uuidv4 } from "uuid";

type ConfigureMagicUrlModalProps = {
  configuration?: IMagicUrlConfig | null;
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const ConfigureMagicUrlModal = ({
  configuration,
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: ConfigureMagicUrlModalProps) => {
  const { t } = useT("os.utilities");
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = isControlled
    ? (value: boolean) => controlledOnOpenChange?.(value)
    : setUncontrolledOpen;
  const [contextName, setContextName] = useState("");
  const [shortUrlBase, setShortUrlBase] = useState("");
  const [errors, setErrors] = useState({ contextName: "", shortUrlBase: "" });
  const { mutateAsync: saveConfig, isPending: isSaving } = useSaveMagicUrlConfig();

  // Opening the modal (or a changed configuration while open) prefills the fields. Done while
  // rendering, keyed on the same values the prefill depends on.
  const prefillKey = JSON.stringify([
    open,
    configuration?.itemId,
    configuration?.contextName,
    configuration?.shortUrlBase,
  ]);
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);
  if (prefilledFor !== prefillKey) {
    setPrefilledFor(prefillKey);
    if (open) {
      if (configuration) {
        setContextName(configuration.contextName || "");
        setShortUrlBase(configuration.shortUrlBase || "");
      } else {
        setContextName("Default");
        setShortUrlBase(getDefaultShortUrlBase());
      }
      setErrors({ contextName: "", shortUrlBase: "" });
    }
  }

  const validateFields = (): boolean => {
    const newErrors = { contextName: "", shortUrlBase: "" };
    if (!contextName.trim()) {
      newErrors.contextName = tStatic("os.utilities", "CONFIGURE_MAGIC_URL_MODAL.CONTEXT_NAME_IS_REQUIRED");
    }
    if (!shortUrlBase.trim()) {
      newErrors.shortUrlBase = tStatic("os.utilities", "CONFIGURE_MAGIC_URL_MODAL.SHORT_URL_BASE_IS_REQUIRED");
    } else if (!isValidUrl(shortUrlBase)) {
      newErrors.shortUrlBase = tStatic("os.utilities", "CONFIGURE_MAGIC_URL_MODAL.URL_MUST_BE_A_VALID");
    } else if (!shortUrlBase.endsWith("/")) {
      newErrors.shortUrlBase = tStatic("os.utilities", "CONFIGURE_MAGIC_URL_MODAL.URL_MUST_END");
    }
    setErrors(newErrors);
    return !newErrors.contextName && !newErrors.shortUrlBase;
  };

  const handleSave = async () => {
    if (!tenantId) return;
    if (!validateFields()) return;
    try {
      const res = await saveConfig({
        projectKey: tenantId,
        contextName: contextName.trim(),
        shortUrlBase: shortUrlBase.trim(),
        itemId: configuration?.itemId ?? uuidv4(),
      });
      if (!res.isSuccess) return showErrorToast({ errors: res.errors });
      showSuccessToast({
        description: configuration
          ? t("CONFIGURE_MAGIC_URL_MODAL.CONFIGURATION_UPDATED_SUCCESSFULLY")
          : t("CONFIGURE_MAGIC_URL_MODAL.CONFIGURATION_ADDED_SUCCESSFULLY"),
      });
      setOpen(false);
    } catch {
      showErrorToast({ errors: t("CONFIGURE_MAGIC_URL_MODAL.FAILED_TO_SAVE_CONFIGURATION") });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
      }}
    >
      {children}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {configuration ? t("CONFIGURE_MAGIC_URL_MODAL.EDIT_MAGIC_URL_CONFIGURATION") : t("CONFIGURE_MAGIC_URL_MODAL.ADD_MAGIC_URL_CONFIGURATION")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="contextName">
              {t("CONFIGURE_MAGIC_URL_MODAL.CONTEXT_NAME", { span: "*" })}
            </Label>
            <Input
              id="contextName"
              placeholder={t("CONFIGURE_MAGIC_URL_MODAL.ENTER_CONTEXT_NAME")}
              value={contextName}
              onChange={(e) => {
                setContextName(e.target.value);
                if (errors.contextName) setErrors((prev) => ({ ...prev, contextName: "" }));
              }}
              disabled={isSaving}
              className={errors.contextName ? "border-error" : ""}
            />
            {errors.contextName && <p className="text-sm text-error">{errors.contextName}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="shortUrlBase">
              {t("CONFIGURE_MAGIC_URL_MODAL.SHORT_URL_BASE", { span: "*" })}
            </Label>
            <Input
              id="shortUrlBase"
              placeholder={t("CONFIGURE_MAGIC_URL_MODAL.E_G_HTTPS_SHORT_SELISEBLOCKS")}
              value={shortUrlBase}
              onChange={(e) => {
                setShortUrlBase(e.target.value);
                if (errors.shortUrlBase) setErrors((prev) => ({ ...prev, shortUrlBase: "" }));
              }}
              disabled={isSaving}
              className={errors.shortUrlBase ? "border-error" : ""}
            />
            {errors.shortUrlBase && <p className="text-sm text-error">{errors.shortUrlBase}</p>}
          </div>
        </div>
        <DialogFooter>
          <DialogTrigger asChild>
            <Button variant="outline" disabled={isSaving}>
              {t("common:CANCEL")}
            </Button>
          </DialogTrigger>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? t("CONFIGURE_MAGIC_URL_MODAL.SAVING") : t("common:SAVE")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
