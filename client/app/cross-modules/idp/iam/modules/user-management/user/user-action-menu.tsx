import { Button } from "@/components/ui-kits/button/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import { RotateCcw, Send } from "lucide-react";
import { useState } from "react";
import { UserResetPassword } from "./user-reset-password";
import { UserResendActivationMail } from "./user-resend-activation/user-resend-activation";
import { DisabledReason } from "@blocks-idp/iam/components/disabled-reason";
import { useUserManageability } from "@blocks-idp/iam/hooks/use-user-manageability";
import { CANNOT_MANAGE_USER_TOOLTIP } from "@blocks-idp/iam/utils/grant-scope";
import { useGetUserById } from "@blocks-idp/iam/hooks/use-user";

type UserActionMenuProps = {
  id: string;
  projectKey: string;
};

export const UserActionMenu = ({ id, projectKey }: UserActionMenuProps) => {
  const { data } = useGetUserById({ id, projectKey });
  const [isResendActivationModalOpen, setIsResendActivationModalOpen] = useState<boolean>(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState<boolean>(false);

  const { canManage } = useUserManageability();
  const blockedReason = canManage(data?.data) ? null : CANNOT_MANAGE_USER_TOOLTIP;
  const isActive = data?.data?.active === true;

  if (blockedReason) {
    return (
      <DisabledReason reason={blockedReason}>
        <Button variant="outline" size="sm" className="gap-1.5" disabled>
          {isActive ? "Reset Password" : "Resend Activation"}
        </Button>
      </DisabledReason>
    );
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
        {isActive ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setIsResetPasswordModalOpen(true)}
                  aria-label="Reset Password"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Reset Password</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setIsResendActivationModalOpen(true)}
                  aria-label="Resend Activation"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Resend Activation</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {isActive ? (
          <Button
            variant="outline"
            size="sm"
            className="hidden gap-1.5 lg:inline-flex"
            onClick={() => setIsResetPasswordModalOpen(true)}
          >
            <RotateCcw className="h-4 w-4" />
            Reset Password
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="hidden gap-1.5 lg:inline-flex"
            onClick={() => setIsResendActivationModalOpen(true)}
          >
            <Send className="h-4 w-4" />
            Resend Activation
          </Button>
        )}
      </div>
      <UserResendActivationMail
        open={isResendActivationModalOpen}
        setOpen={setIsResendActivationModalOpen}
        userId={id}
      />
      <UserResetPassword
        userId={id}
        open={isResetPasswordModalOpen}
        setOpen={setIsResetPasswordModalOpen}
      />
    </>
  );
};
