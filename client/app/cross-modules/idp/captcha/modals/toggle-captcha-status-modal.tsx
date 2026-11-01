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
import { useT } from "@seliseblocks/genesis-os";
type ToggleCaptchaStatusModalProps = {
  configuration: ICaptchaConfig;
  children?: React.ReactNode;
};
export const ToggleCaptchaStatusModal = ({
  configuration,
  children,
}: ToggleCaptchaStatusModalProps) => {
  const { t } = useT("os.idp.captcha");
  const [open, setOpen] = useState<boolean>(false);
  const { isPending, mutateAsync } = useToggleCaptchaConfigStatus();
  const providerType = CAPTCHA_PROVIDERS[configuration.provider];
  const onConfirm = async () => {
    try {
      if (!configuration) return showErrorToast({ errors: t("TOGGLE_CAPTCHA_STATUS_MODAL.GENERIC_ERROR") });
      // No captchaSecret here: omitting it tells the backend to leave the stored secret
      // untouched, which is exactly what a pure enable/disable toggle should do.
      await mutateAsync({
        id: configuration.id,
        isEnable: !configuration.isEnable,
        provider: configuration.provider,
        captchaKey: configuration.captchaKey,
        captchaGenerator: configuration.captchaGenerator,
      });
      showSuccessToast({
        description: configuration.isEnable
          ? t("TOGGLE_CAPTCHA_STATUS_MODAL.DISABLED_SUCCESS", { provider: providerType.label })
          : t("TOGGLE_CAPTCHA_STATUS_MODAL.ENABLED_SUCCESS", { provider: providerType.label }),
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
            <span className="ml-2.5">
              {configuration?.isEnable ? t("TOGGLE_CAPTCHA_STATUS_MODAL.DISABLE") : t("TOGGLE_CAPTCHA_STATUS_MODAL.ENABLE")}
            </span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {configuration?.isEnable ? t("TOGGLE_CAPTCHA_STATUS_MODAL.TITLE_DISABLE") : t("TOGGLE_CAPTCHA_STATUS_MODAL.TITLE_ENABLE")}
          </DialogTitle>
          <DialogDescription>
            {configuration?.isEnable
              ? t("TOGGLE_CAPTCHA_STATUS_MODAL.DESCRIPTION_DISABLE", { provider: providerType.label })
              : t("TOGGLE_CAPTCHA_STATUS_MODAL.DESCRIPTION_ENABLE", { provider: providerType.label })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              {t("common:CANCEL")}
            </Button>
          </DialogTrigger>
          <Button size="sm" onClick={onConfirm} disabled={isPending}>
            {t("common:YES")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
