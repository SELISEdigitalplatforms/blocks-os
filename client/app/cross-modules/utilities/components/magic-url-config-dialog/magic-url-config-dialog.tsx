import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogContent,
} from "@/components/ui-kits/dialog/dialog";
import { Button } from "@/components/ui-kits/button/button";
import { Input } from "@/components/ui-kits/input/input";
import { Label } from "@/components/ui-kits/label/label";
import {
  useGetMagicUrlConfigs,
  useSaveMagicUrlConfig,
} from "@blocks-utilities/hooks/use-magic-url-config";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { getDefaultShortUrlBase, isValidUrl } from "@blocks-utilities/utils/url.util";
import { useProjectStore } from "@/store/useProjectStore";
import { v4 as uuidv4 } from "uuid";

interface MagicUrlConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export const MagicUrlConfigDialog = ({
  open,
  onOpenChange,
  trigger,
}: MagicUrlConfigDialogProps) => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const [contextName, setContextName] = useState("");
  const [shortUrlBase, setShortUrlBase] = useState("");
  const [errors, setErrors] = useState({ contextName: "", shortUrlBase: "" });

  const { data: configData } = useGetMagicUrlConfigs(
    { projectKey: tenantId },
    { enabled: open && !!tenantId },
  );
  const { mutateAsync: saveConfig, isPending: isSaving } = useSaveMagicUrlConfig();

  const existingConfig = configData?.configurations?.[0];

  useEffect(() => {
    if (!open) return;
    if (existingConfig) {
      setContextName(existingConfig.contextName || "");
      setShortUrlBase(existingConfig.shortUrlBase || "");
    } else {
      setContextName("Default");
      setShortUrlBase(getDefaultShortUrlBase());
    }
    setErrors({ contextName: "", shortUrlBase: "" });
  }, [open, existingConfig?.itemId, existingConfig?.contextName, existingConfig?.shortUrlBase]);

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
        itemId: existingConfig?.itemId ?? uuidv4(),
      });
      if (!res.isSuccess) return showErrorToast({ errors: res.errors });
      showSuccessToast({ description: "Configuration updated successfully" });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save config:", error);
      showErrorToast({ errors: "Failed to save configuration" });
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  return (
    <>
      {trigger && (
        <div onClick={() => handleOpenChange(true)} className="cursor-pointer">
          {trigger}
        </div>
      )}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Magic URL</DialogTitle>
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
              {errors.shortUrlBase && (
                <p className="text-sm text-error">{errors.shortUrlBase}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
