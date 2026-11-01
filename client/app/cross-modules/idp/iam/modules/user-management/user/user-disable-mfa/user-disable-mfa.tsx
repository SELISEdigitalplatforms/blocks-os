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
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { useT } from "@seliseblocks/genesis-os";
import { useDisableMfa } from "@blocks-idp/mfa/hooks/use-mfa-config";

type UserDisableMFAProps = {
  userId: string;
  // OS scopes the MFA cache invalidation by project, so the caller has to pass
  // the tenant id the user record was read with.
  projectKey: string;
  open: boolean;
  setOpen: (open: boolean) => void;
};

export const UserDisableMFA = ({ userId, projectKey, open, setOpen }: UserDisableMFAProps) => {
  const { t } = useT("os.idp.users");
  const { isPending, mutateAsync } = useDisableMfa({ id: userId, projectKey });
  const onClickHandler = async () => {
    try {
      const res = await mutateAsync({
        userId,
        projectKey,
      });
      if (!res.isSuccess) return showErrorToast({ errors: res.errors });
      showSuccessToast({ description: t("USER_DISABLE_MFA.SUCCESS") });
      setOpen(false);
    } catch (error) {
      if (isErrorWithErrors(error)) {
        showErrorToast({ errors: error.errors });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("USER_DISABLE_MFA.TITLE")}</DialogTitle>
          <DialogDescription>
            {t("USER_DISABLE_MFA.DESCRIPTION")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={isPending} className="w-full sm:w-auto">
              {t("common:CANCEL")}
            </Button>
          </DialogTrigger>
          <Button size="sm" onClick={onClickHandler} disabled={isPending} className="w-full sm:w-auto">
            {isPending ? t("USER_DISABLE_MFA.PROCESSING") : t("common:YES")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
