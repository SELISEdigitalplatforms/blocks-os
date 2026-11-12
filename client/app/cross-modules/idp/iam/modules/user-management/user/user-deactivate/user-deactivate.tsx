import { useRef } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import { useAccountDeactivate } from "@blocks-idp/iam/hooks/use-account";
import { useT } from "@seliseblocks/genesis-os";
import {
  showStatusChangeError,
  showStatusChangeResult,
  StatusChangeKeys,
} from "./user-status-change-feedback";

const DEACTIVATE_KEYS: StatusChangeKeys = {
  success: "USER_DEACTIVATE.SUCCESS",
  somethingWentWrong: "USER_DEACTIVATE.SOMETHING_WENT_WRONG",
};

type UserDeactivateProps = {
  userId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
};

/**
 * Deactivates the account: IAM ends every session at once. The dialog closes once the request
 * settles, whatever the outcome; the status shown afterwards always comes from re-reading the user.
 */
export const UserDeactivate = ({ userId, open, setOpen }: Readonly<UserDeactivateProps>) => {
  const { t } = useT("os.idp.users");
  const { mutateAsync, isPending } = useAccountDeactivate();
  // Guards the click that lands before the pending state has re-rendered the disabled button.
  const inFlight = useRef(false);

  const deactivate = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      showStatusChangeResult(await mutateAsync({ userId }), t, DEACTIVATE_KEYS);
    } catch (error) {
      showStatusChangeError(error, t, DEACTIVATE_KEYS);
    } finally {
      inFlight.current = false;
      setOpen(false);
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      title={t("USER_DEACTIVATE.DIALOG_TITLE")}
      description={t("USER_DEACTIVATE.DIALOG_SUBTITLE")}
      confirmLabel={t("USER_DEACTIVATE.CONFIRM")}
      cancelLabel={t("common:CANCEL")}
      onConfirm={() => void deactivate()}
      isPending={isPending}
      destructive
    />
  );
};
