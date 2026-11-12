import { useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import { useAccountActivateByAdmin } from "@blocks-idp/iam/hooks/use-account";
import { useT } from "@seliseblocks/genesis-os";
import {
  showStatusChangeError,
  showStatusChangeResult,
  StatusChangeKeys,
} from "../user-deactivate/user-status-change-feedback";

// IAM requires at least 3 characters after trimming and has no maximum; 500 is the console's own cap.
const REASON_MIN_LENGTH = 3;
const REASON_MAX_LENGTH = 500;

const ACTIVATE_KEYS: StatusChangeKeys = {
  success: "USER_ACTIVATE.SUCCESS",
  somethingWentWrong: "USER_ACTIVATE.SOMETHING_WENT_WRONG",
};

const createActivateFormSchema = (t: (key: string) => string) =>
  z.object({
    reason: z
      .string()
      .trim()
      .min(REASON_MIN_LENGTH, t("USER_ACTIVATE.REASON_TOO_SHORT"))
      .max(REASON_MAX_LENGTH, t("USER_ACTIVATE.REASON_TOO_LONG")),
  });

type UserActivateProps = {
  userId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
};

/**
 * Reinstates a deactivated or suspended account with a reason. The dialog closes once the request
 * settles, whatever the outcome; the status shown afterwards always comes from re-reading the user.
 */
export const UserActivate = ({ userId, open, setOpen }: Readonly<UserActivateProps>) => {
  const { t } = useT("os.idp.users");
  const { mutateAsync, isPending } = useAccountActivateByAdmin();
  // Guards the submit that lands before the pending state has re-rendered the disabled button.
  const inFlight = useRef(false);
  const schema = useMemo(() => createActivateFormSchema(t), [t]);
  const form = useForm({ defaultValues: { reason: "" }, resolver: zodResolver(schema) });
  const { reset } = form;

  // Every opening starts from an empty reason, without a leftover error.
  useEffect(() => {
    if (open) reset({ reason: "" });
  }, [open, reset]);

  const activate = async ({ reason }: z.output<typeof schema>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      showStatusChangeResult(await mutateAsync({ userId, reason }), t, ACTIVATE_KEYS);
    } catch (error) {
      showStatusChangeError(error, t, ACTIVATE_KEYS);
    } finally {
      inFlight.current = false;
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("USER_ACTIVATE.DIALOG_TITLE")}</DialogTitle>
          <DialogDescription>{t("USER_ACTIVATE.DIALOG_SUBTITLE")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            noValidate
            onSubmit={(event) => void form.handleSubmit(activate)(event)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("USER_ACTIVATE.REASON_LABEL")}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      maxLength={REASON_MAX_LENGTH}
                      placeholder={t("USER_ACTIVATE.REASON_PLACEHOLDER")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setOpen(false)}
              >
                {t("common:CANCEL")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <span>{t("USER_ACTIVATE.CONFIRM")}</span>
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
