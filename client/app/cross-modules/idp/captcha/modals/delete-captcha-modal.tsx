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

type DeleteCaptchaModalProps = {
  configuration: ICaptchaConfig;
  children?: React.ReactNode;
};

export const DeleteCaptchaModal = ({ configuration, children }: DeleteCaptchaModalProps) => {
  const [open, setOpen] = useState<boolean>(false);
  const { isPending, mutateAsync } = useDeleteCaptcha();
  const providerType = CAPTCHA_PROVIDERS[configuration.provider];

  const onConfirm = async () => {
    try {
      await mutateAsync(configuration.id);
      showSuccessToast({
        description: `${providerType.label} configuration deleted successfully`,
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
            <span className="ml-2.5">Delete</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete CAPTCHA configuration?</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the {providerType.label} configuration? This action
            cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Cancel
            </Button>
          </DialogTrigger>
          <Button size="sm" variant="destructive" onClick={onConfirm} disabled={isPending}>
            Yes, delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
