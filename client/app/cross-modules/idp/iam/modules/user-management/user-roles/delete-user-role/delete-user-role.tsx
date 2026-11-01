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
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { useUserRoles } from "@blocks-idp/iam/hooks/use-user";
import { IRole } from "@blocks-idp/iam/models/role";
import { X } from "lucide-react";
import { useState } from "react";
import { useT } from "@seliseblocks/genesis-os";

type DeleteUserRoleProps = {
  role: IRole;
  userId: string;
  projectKey: string;
};

export const DeleteUserRole = ({ role, userId, projectKey }: DeleteUserRoleProps) => {
  const { t } = useT("os.idp.users");
  const [open, setOpen] = useState<boolean>(false);
  const { deleteRoles, isPending } = useUserRoles({ id: userId, projectKey });

  const onClickHandler = async () => {
    try {
      const res = await deleteRoles([role.slug]);
      if (!res.isSuccess) return showErrorToast({ errors: res.errors });
      showSuccessToast({ description: t("DELETE_USER_ROLE.EXCLUDED") });
      setOpen(false);
    } catch (error) {
      if (isErrorWithErrors(error)) return showErrorToast({ errors: error.errors });
      showErrorToast({ errors: t("DELETE_USER_ROLE.SOMETHING_WENT_WRONG") });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <X className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("DELETE_USER_ROLE.TITLE")}</DialogTitle>
          <DialogDescription>{t("DELETE_USER_ROLE.DESCRIPTION")}</DialogDescription>
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
            {isPending ? t("DELETE_USER_ROLE.PROCESSING") : t("common:YES")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
