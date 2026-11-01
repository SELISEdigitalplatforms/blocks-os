import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { useAccountDeactivate } from "@blocks-idp/iam/hooks/use-account";
import { isErrorWithErrors } from "@/lib/error";
import { useT } from "@seliseblocks/genesis-os";

type UserDeactivateProps = {
  userId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
};

export const UserDeactivate = ({
  userId,
  open,
  setOpen,
}: UserDeactivateProps) => {
  const { t } = useT("os.idp.users");
  const { mutateAsync, isPending } = useAccountDeactivate();
  const onClickHandler = async () => {
    try {
      const res = await mutateAsync({ userId });
      if (res.isSuccess) {
        showSuccessToast({
          description: t("USER_DEACTIVATE.SUCCESS"),
        });
      } else {
        showErrorToast({ errors: res.errors });
      }
    } catch (error) {
      if (isErrorWithErrors(error)) {
        showErrorToast({ errors: error.errors });
      } else {
        showErrorToast({ errors: t("USER_DEACTIVATE.SOMETHING_WENT_WRONG") });
      }
    } finally {
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <ConfirmationModal
        onCancel={() => setOpen(false)}
        onConfirm={onClickHandler}
        data={{
          dialogTitle: t("USER_DEACTIVATE.DIALOG_TITLE"),
          dialogSubtitle: t("USER_DEACTIVATE.DIALOG_SUBTITLE"),
          confirmButton: t("USER_DEACTIVATE.CONFIRM"),
        }}
        buttonState={{
          confirm: { disable: isPending },
        }}
      />
    </Dialog>
  );
};
