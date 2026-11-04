import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import { toast } from "@/hooks/use-toast";
import { useProjectStore, useT } from "@seliseblocks/genesis-os";
import { useUserPermissions } from "@blocks-idp/iam/hooks/use-user";
import { IPermission } from "@blocks-idp/iam/models/permission";
import { X } from "lucide-react";
import { useState } from "react";

type DeleteUserPermissionProps = {
  permission: IPermission;
  userId: string;
};

export const DeleteUserPermission = ({ permission, userId }: DeleteUserPermissionProps) => {
  const { t } = useT("os.idp.users");
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const [open, setOpen] = useState<boolean>(false);
  const { deletePermissions, isPending } = useUserPermissions({ userId, projectKey: tenantId });

  const onClickHandler = async () => {
    try {
      const res = await deletePermissions([permission.resource]);
      if (res.isSuccess) {
        toast({
          variant: "success",
          title: t("DELETE_USER_PERMISSION.SUCCESS_TITLE"),
          description: t("DELETE_USER_PERMISSION.EXCLUDED"),
        });
        setOpen(false);
      } else {
        toast({
          variant: "destructive",
          title: t("DELETE_USER_PERMISSION.ERROR_TITLE"),
          description: t("DELETE_USER_PERMISSION.SOMETHING_WENT_WRONG"),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("DELETE_USER_PERMISSION.ERROR_TITLE"),
        description: t("DELETE_USER_PERMISSION.SOMETHING_WENT_WRONG_DETAILS", {
          details: JSON.stringify(error),
        }),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <X className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("DELETE_USER_PERMISSION.TITLE")}</DialogTitle>
          <DialogDescription>{t("DELETE_USER_PERMISSION.DESCRIPTION")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button className="min-w-[80px]" variant="outline" size="default" disabled={isPending}>
              {t("common:CANCEL")}
            </Button>
          </DialogClose>
          <Button
            className="min-w-[80px]"
            size="default"
            disabled={isPending}
            onClick={onClickHandler}
          >
            {isPending ? t("DELETE_USER_PERMISSION.PROCESSING") : t("common:YES")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
