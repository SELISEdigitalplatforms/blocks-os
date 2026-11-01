import { Button } from "@/components/ui-kits/button/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import React from "react";
import { useT } from "@seliseblocks/genesis-os";
import { toast } from "@/hooks/use-toast";
import { useDeleteEmailConfig } from "../../../../hooks/use-email-config";
interface DeleteEmailConfigProps {
  configId: string;
  onClose: () => void;
}
const DeleteEmailConfig: React.FC<DeleteEmailConfigProps> = ({ configId, onClose }) => {
  const { t } = useT("os.communication.mail");
  const { isPending, mutateAsync } = useDeleteEmailConfig();
  const deleteConfig = async () => {
    try {
      const res = await mutateAsync({ configurationId: configId });
      if (res?.isSuccess) {
        toast({
          variant: "success",
          title: t("common:SUCCESS"),
          description: t("DELETE_EMAIL_CONFIG.DELETED_SUCCESS"),
        });
        onClose();
      } else {
        toast({
          variant: "destructive",
          title: t("common:ERROR"),
          description: JSON.stringify(res?.errors),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("common:ERROR"),
        description: JSON.stringify(error),
      });
    }
  };
  return (
    <DialogContent className="rounded-md sm:max-w-[450px]">
      <DialogHeader>
        <DialogTitle className="text-left">{t("DELETE_EMAIL_CONFIG.TITLE")}</DialogTitle>
        <DialogDescription className="mt-4 text-left">
          <div>{t("DELETE_EMAIL_CONFIG.CONFIRM")}</div>
          <span className="opacity-0">{configId}</span>
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="flex flex-row gap-2">
        <DialogTrigger>
          <Button variant="outline" size="default" disabled={false}>
            {t("common:CANCEL")}
          </Button>
        </DialogTrigger>
        <Button size="default" className="bg-error" onClick={deleteConfig} disabled={isPending}>
          {t("DELETE_EMAIL_CONFIG.DELETE_CONFIGURATION")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};
export default DeleteEmailConfig;
