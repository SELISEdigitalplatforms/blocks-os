import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";

import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
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
  const { mutateAsync, isPending } = useAdminResetPassword();

  const onClickHandler = async () => {
    try {
      const res = await mutateAsync({ userId });
      if (res.isSuccess) {
        showSuccessToast({
          description:
            "Password reset email has been sent. Please check your email",
        });
        setOpen(false);
      } else {
        showErrorToast({ errors: res.errors });
      }
    } catch (error) {
      if (isErrorWithErrors(error)) {
        showErrorToast({ errors: error.errors });
      } else {
        showErrorToast({ errors: "Something went wrong" });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <ConfirmationModal
        onCancel={() => setOpen(false)}
        onConfirm={onClickHandler}
        data={{
          dialogTitle: "Reset password",
          dialogSubtitle:
            "Are you sure you want to reset the password for this user?",
          confirmButton: "Reset",
        }}
        buttonState={{
          confirm: { disable: isPending },
        }}
      />
    </Dialog>
  );
};
