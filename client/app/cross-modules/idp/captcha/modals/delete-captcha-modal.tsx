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
import { useDeleteCaptcha } from "../hooks/use-captcha-config";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { CAPTCHA_PROVIDERS, ICaptchaConfig } from "../models/captcha";
import { isErrorWithErrors } from "@/lib/error";
import { Trash2 } from "lucide-react";
import { useT } from "@seliseblocks/genesis-os";

type DeleteCaptchaModalProps = {
  configuration: ICaptchaConfig;
  children?: React.ReactNode;
};

export const DeleteCaptchaModal = ({ configuration, children }: DeleteCaptchaModalProps) => {
  const { t } = useT("os.idp.captcha");
  const [open, setOpen] = useState<boolean>(false);
  const { isPending, mutateAsync } = useDeleteCaptcha();
  const providerType = CAPTCHA_PROVIDERS[configuration.provider];

  const onConfirm = async () => {
    try {
      await mutateAsync(configuration.id);
      showSuccessToast({
        description: t("DELETE_CAPTCHA_MODAL.DELETED", { provider: providerType.label }),
      });
      setOpen(false);
    } catch (error) {
      if (isErrorWithErrors(error)) {
        showErrorToast({ errors: error.errors });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button size="sm" variant="outline">
            <Trash2 className="h-4 w-4" />
            <span className="ml-2.5">{t("common:DELETE")}</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("DELETE_CAPTCHA_MODAL.TITLE")}</DialogTitle>
          <DialogDescription>
            {t("DELETE_CAPTCHA_MODAL.DESCRIPTION", { provider: providerType.label })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              {t("common:CANCEL")}
            </Button>
          </DialogTrigger>
          <Button size="sm" variant="destructive" onClick={onConfirm} disabled={isPending}>
            {t("DELETE_CAPTCHA_MODAL.CONFIRM")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
