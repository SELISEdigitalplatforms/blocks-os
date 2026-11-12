import { forwardRef, useRef, useState } from "react";
import { EllipsisVertical, RotateCcw, Send, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import { useT } from "@seliseblocks/genesis-os";
import { UserResetPassword } from "./user-reset-password";
import { UserResendActivationMail } from "./user-resend-activation/user-resend-activation";
import { UserDeactivate } from "./user-deactivate";
import { UserActivate } from "./user-activate";
import { DisabledReason } from "@blocks-idp/iam/components/disabled-reason";
import { useUserManageability } from "@blocks-idp/iam/hooks/use-user-manageability";
import { getCannotManageUserTooltip } from "@blocks-idp/iam/utils/grant-scope";
import { useGetUserById } from "@blocks-idp/iam/hooks/use-user";
import { resolveUserAccountState } from "@blocks-idp/iam/utils/user-account-state";

type ActionDialog = "reset-password" | "resend-activation" | "deactivate" | "activate";

type UserActionMenuProps = {
  id: string;
  projectKey: string;
};

const MoreActionsButton = forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof Button> & { label: string }
>(({ label, ...props }, ref) => (
  <Button ref={ref} variant="outline" size="icon" aria-label={label} {...props}>
    <EllipsisVertical className="h-4 w-4" />
  </Button>
));
MoreActionsButton.displayName = "MoreActionsButton";

/**
 * The user detail header's ⋮ menu. It offers only what IAM accepts for the account's state:
 * reset password and deactivate for an active account, activate for a deactivated or suspended
 * one, resend activation for an invitation never accepted.
 */
export const UserActionMenu = ({ id, projectKey }: UserActionMenuProps) => {
  const { t } = useT("os.idp.users");
  const { data, isLoading, isError } = useGetUserById({ id, projectKey });
  const { canManage } = useUserManageability();
  const [openDialog, setOpenDialog] = useState<ActionDialog | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const label = t("USER_ACTION_MENU.MORE_ACTIONS");
  const user = data?.data;

  if (isLoading || isError || !user) return <MoreActionsButton label={label} disabled />;

  if (!canManage(user)) {
    return (
      <DisabledReason reason={getCannotManageUserTooltip()}>
        <MoreActionsButton label={label} disabled />
      </DisabledReason>
    );
  }

  const changeDialog = (dialog: ActionDialog, open: boolean) => {
    if (open) {
      setOpenDialog(dialog);
      return;
    }
    setOpenDialog(null);
    // The dialog opens while the menu is still closing, so the element it would hand focus back
    // to is the menu item, which is gone by then. Give focus to the trigger instead.
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const state = resolveUserAccountState(user);
  const isBlocked = state === "Deactivated" || state === "Suspended";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <MoreActionsButton ref={triggerRef} label={label} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {state === "Active" && (
            <>
              <DropdownMenuItem onSelect={() => setOpenDialog("reset-password")}>
                <RotateCcw className="mr-2 h-4 w-4" />
                <span>{t("USER_ACTION_MENU.RESET_PASSWORD")}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setOpenDialog("deactivate")}
              >
                <UserX className="mr-2 h-4 w-4" />
                <span>{t("USER_ACTION_MENU.DEACTIVATE_ACCOUNT")}</span>
              </DropdownMenuItem>
            </>
          )}
          {isBlocked && (
            <DropdownMenuItem onSelect={() => setOpenDialog("activate")}>
              <UserCheck className="mr-2 h-4 w-4" />
              <span>{t("USER_ACTION_MENU.ACTIVATE_ACCOUNT")}</span>
            </DropdownMenuItem>
          )}
          {state === "PendingVerification" && (
            <DropdownMenuItem onSelect={() => setOpenDialog("resend-activation")}>
              <Send className="mr-2 h-4 w-4" />
              <span>{t("USER_ACTION_MENU.RESEND_ACTIVATION")}</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <UserResetPassword
        userId={id}
        open={openDialog === "reset-password"}
        setOpen={(open) => changeDialog("reset-password", open)}
      />
      <UserResendActivationMail
        userId={id}
        open={openDialog === "resend-activation"}
        setOpen={(open) => changeDialog("resend-activation", open)}
      />
      <UserDeactivate
        userId={id}
        open={openDialog === "deactivate"}
        setOpen={(open) => changeDialog("deactivate", open)}
      />
      <UserActivate
        userId={id}
        open={openDialog === "activate"}
        setOpen={(open) => changeDialog("activate", open)}
      />
    </>
  );
};
