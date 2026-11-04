import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { toast } from "@/hooks/use-toast";
import { useT } from "@seliseblocks/genesis-os";
import { useAccountResendActivation } from "@blocks-idp/iam/hooks/use-account";

type UserResendActivationMailProps = {
  userId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
};

export const UserResendActivationMail = ({
  userId,
  open,
  setOpen,
}: UserResendActivationMailProps) => {
  const { t } = useT("os.idp.users");
  const { mutateAsync, isPending } = useAccountResendActivation();
  const onClickHandler = async () => {
    try {
      const res = await mutateAsync({ userId });
      if (res.isSuccess) {
        toast({
          variant: "success",
          title: t("USER_RESEND_ACTIVATION.SUCCESS_TITLE"),
          description: t("USER_RESEND_ACTIVATION.SUCCESS_DESCRIPTION"),
        });
      } else {
        toast({
          variant: "destructive",
          title: t("USER_RESEND_ACTIVATION.ERROR_TITLE"),
          description: t("USER_RESEND_ACTIVATION.FAILED_DESCRIPTION", {
            details: JSON.stringify(res.errors),
          }),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("USER_RESEND_ACTIVATION.ERROR_TITLE"),
        description: t("USER_RESEND_ACTIVATION.SOMETHING_WENT_WRONG", {
          details: JSON.stringify(error),
        }),
      });
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
          dialogTitle: t("USER_RESEND_ACTIVATION.DIALOG_TITLE"),
          dialogSubtitle: t("USER_RESEND_ACTIVATION.DIALOG_SUBTITLE"),
          confirmButton: t("USER_RESEND_ACTIVATION.CONFIRM"),
        }}
        buttonState={{
          confirm: { disable: isPending },
        }}
      />
    </Dialog>
  );
};
