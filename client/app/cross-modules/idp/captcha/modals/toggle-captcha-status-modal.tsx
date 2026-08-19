import React, { useState } from "react";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import { useToggleCaptchaConfigStatus } from "../hooks/use-captcha-config";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { CAPTCHA_PROVIDERS, ICaptchaConfig } from "../models/captcha";
import { isErrorWithErrors } from "@/lib/error";
import { Check, X } from "lucide-react";
type ToggleCaptchaStatusModalProps = {
  configuration: ICaptchaConfig;
  children?: React.ReactNode;
};
export const ToggleCaptchaStatusModal = ({
  configuration,
  children,
}: ToggleCaptchaStatusModalProps) => {
  const [open, setOpen] = useState<boolean>(false);
  const { isPending, mutateAsync } = useToggleCaptchaConfigStatus();
  const providerType = CAPTCHA_PROVIDERS[configuration.provider];
  const onConfirm = async () => {
    try {
      if (!configuration) return showErrorToast({ errors: "Something went wrong" });
      // No captchaSecret here: omitting it tells the backend to leave the stored secret
      // untouched, which is exactly what a pure enable/disable toggle should do.
      await mutateAsync({
        isEnable: !configuration.isEnable,
        provider: configuration.provider,
        captchaKey: configuration.captchaKey,
        captchaGenerator: configuration.captchaGenerator,
      });
      showSuccessToast({
        description: `${providerType.label} is ${configuration.isEnable ? "disabled" : "enabled"} successfully`,
      });
      setOpen(false);
    } catch (error) {
      if (isErrorWithErrors(error)) {
        showErrorToast({ errors: error.errors });
      }
    }
  };
  const IconComponent = configuration?.isEnable ? X : Check;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button size="sm" variant="outline">
            <IconComponent className="h-4 w-4" />
            <span className="ml-2.5">{configuration?.isEnable ? "Disable" : "Enable"}</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{configuration?.isEnable ? "Disable" : "Enable"} CAPTCHA?</DialogTitle>
          <DialogDescription>
            Are you sure you want to {configuration?.isEnable ? "disable" : "enable"}{" "}
            {providerType.label}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Cancel
            </Button>
          </DialogTrigger>
          <Button size="sm" onClick={onConfirm} disabled={isPending}>
            Yes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
