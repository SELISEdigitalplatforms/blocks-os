import React, { ReactNode, useEffect, useState } from "react";
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
import { useProjectStore } from "@seliseblocks/blocks-kit";
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

  useEffect(() => {
    if (!open) return;
    if (configuration) {
      setContextName(configuration.contextName || "");
      setShortUrlBase(configuration.shortUrlBase || "");
    } else {
      setContextName("Default");
      setShortUrlBase(getDefaultShortUrlBase());
    }
    setErrors({ contextName: "", shortUrlBase: "" });
  }, [open, configuration?.itemId, configuration?.contextName, configuration?.shortUrlBase]);

  const validateFields = (): boolean => {
    const newErrors = { contextName: "", shortUrlBase: "" };
    if (!contextName.trim()) {
      newErrors.contextName = "Context name is required";
    }
    if (!shortUrlBase.trim()) {
      newErrors.shortUrlBase = "Short URL base is required";
    } else if (!isValidUrl(shortUrlBase)) {
      newErrors.shortUrlBase = "URL must be a valid HTTPS/HTTP URL";
    } else if (!shortUrlBase.endsWith("/")) {
      newErrors.shortUrlBase = "URL must end with a forward slash (/)";
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
          ? "Configuration updated successfully"
          : "Configuration added successfully",
      });
      setOpen(false);
    } catch {
      showErrorToast({ errors: "Failed to save configuration" });
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
            {configuration ? "Edit Magic URL Configuration" : "Add Magic URL Configuration"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="contextName">
              Context Name <span className="text-error">*</span>
            </Label>
            <Input
              id="contextName"
              placeholder="Enter context name"
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
              Short URL Base <span className="text-error">*</span>
            </Label>
            <Input
              id="shortUrlBase"
              placeholder="e.g., https://short.seliseblocks.com/"
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
              Cancel
            </Button>
          </DialogTrigger>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
