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
      showSuccessToast({ description: "Organization membership removed successfully" });
      handleOpenChange(false);
      onSuccess?.();
    } catch (error) {
      showErrorToast({
        errors:
          typeof error === "object" && error !== null && "errors" in error
            ? (error as { errors: unknown }).errors
            : "Something went wrong",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Remove organization membership</DialogTitle>
          <DialogDescription>
            Are you sure you want to remove the user from &quot;{organizationName}&quot;? This will
            revoke all roles associated with this organization.
          </DialogDescription>
        </DialogHeader>

        <NotifyUserCheckbox
          checked={notifyUser}
          onCheckedChange={setNotifyUser}
          disabled={isPending}
          description="Send them an email saying they were removed from this organization."
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? "Removing..." : "Remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
