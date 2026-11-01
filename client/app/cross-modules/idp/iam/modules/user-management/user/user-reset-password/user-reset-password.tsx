import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";

import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { useT } from "@seliseblocks/genesis-os";
import { useAdminResetPassword } from "@blocks-idp/iam/hooks/use-account";

type UserResetPasswordProps = {
  userId: string;
  open: boolean;
  setOpen: (value: boolean) => void;
};

// Uses the protected admin reset (no captcha), not the public forgot-password flow.
export const UserResetPassword = ({
  userId,
  open,
  setOpen,
}: Readonly<UserResetPasswordProps>) => {
  const { t } = useT("os.idp.users");
  const { mutateAsync, isPending } = useAdminResetPassword();

  const onClickHandler = async () => {
    try {
      const res = await mutateAsync({ userId });
      if (res.isSuccess) {
        showSuccessToast({
          description: t("USER_RESET_PASSWORD.SUCCESS"),
        });
        setOpen(false);
      } else {
        showErrorToast({ errors: res.errors });
      }
    } catch (error) {
      if (isErrorWithErrors(error)) {
        showErrorToast({ errors: error.errors });
      } else {
        showErrorToast({ errors: t("USER_RESET_PASSWORD.SOMETHING_WENT_WRONG") });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <ConfirmationModal
        onCancel={() => setOpen(false)}
        onConfirm={onClickHandler}
        data={{
          dialogTitle: t("USER_RESET_PASSWORD.DIALOG_TITLE"),
          dialogSubtitle: t("USER_RESET_PASSWORD.DIALOG_SUBTITLE"),
          confirmButton: t("USER_RESET_PASSWORD.CONFIRM"),
        }}
        buttonState={{
          confirm: { disable: isPending },
        }}
      />
    </Dialog>
  );
};
