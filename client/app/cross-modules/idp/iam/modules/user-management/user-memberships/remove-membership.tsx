import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useT } from "@seliseblocks/genesis-os";
import { useRevokeAccess } from "@blocks-idp/iam/hooks/use-user";
import { IMembership } from "@blocks-idp/iam/models/user";
import { NotifyUserCheckbox } from "@blocks-idp/iam/components/notify-user-checkbox";

type RemoveMembershipProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membership: IMembership;
  organizationName: string;
  userId: string;
  projectKey: string;
  onSuccess?: () => void;
};

export const RemoveMembership = ({
  open,
  onOpenChange,
  membership,
  organizationName,
  userId,
  onSuccess,
}: RemoveMembershipProps) => {
  const { t } = useT("os.idp.users");
  const { mutateAsync, isPending } = useRevokeAccess({ id: userId });
  const [notifyUser, setNotifyUser] = useState(true);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setNotifyUser(true);
    onOpenChange(nextOpen);
  };

  const onConfirm = async () => {
    try {
      const res = await mutateAsync({
        organizationId: membership.organizationId,
        notifyUser,
      });
      if (!res.isSuccess) {
        showErrorToast({ errors: res.errors });
        return;
      }
      showSuccessToast({ description: t("REMOVE_MEMBERSHIP.REMOVED") });
      handleOpenChange(false);
      onSuccess?.();
    } catch (error) {
      showErrorToast({
        errors:
          typeof error === "object" && error !== null && "errors" in error
            ? (error as { errors: unknown }).errors
            : t("REMOVE_MEMBERSHIP.SOMETHING_WENT_WRONG"),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("REMOVE_MEMBERSHIP.TITLE")}</DialogTitle>
          <DialogDescription>
            {t("REMOVE_MEMBERSHIP.DESCRIPTION", { organization: organizationName })}
          </DialogDescription>
        </DialogHeader>

        <NotifyUserCheckbox
          checked={notifyUser}
          onCheckedChange={setNotifyUser}
          disabled={isPending}
          description={t("REMOVE_MEMBERSHIP.NOTIFY_DESCRIPTION")}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t("common:CANCEL")}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? t("REMOVE_MEMBERSHIP.REMOVING") : t("common:REMOVE")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
