import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { Dialog, DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import { IPermission } from "@blocks-idp/iam/models/permission";
import { X } from "lucide-react";
import { useT } from "@seliseblocks/genesis-os";
import { useState } from "react";

type DeleteOrganizationPermissionProps = {
  permission: IPermission;
  onDelete: (permission: IPermission) => void;
  onSave?: () => void;
};

export const DeleteOrganizationPermission = ({
  permission,
  onDelete,
  onSave,
}: DeleteOrganizationPermissionProps) => {
  const { t } = useT("os.idp.users");
  const [open, setOpen] = useState<boolean>(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <X className="h-4 w-4 cursor-pointer" />
      </DialogTrigger>
      <ConfirmationModal
        data={{
          dialogTitle: t("DELETE_ORGANIZATION_PERMISSION.TITLE"),
          dialogSubtitle: t("DELETE_ORGANIZATION_PERMISSION.DESCRIPTION"),
        }}
        onConfirm={() => {
          onDelete(permission);
          // Defer save so the parent's queued state update lands before
          // `onSave` reads the new selection.
          setTimeout(() => onSave?.(), 0);
        }}
        onCancel={() => setOpen(false)}
      />
    </Dialog>
  );
};
