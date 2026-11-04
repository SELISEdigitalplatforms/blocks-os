import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import { Button } from "@/components/ui-kits/button/button";
import { IRole } from "@blocks-idp/iam/models/role";
import { X } from "lucide-react";
import { useT } from "@seliseblocks/genesis-os";
import { useState } from "react";

type DeleteOrganizationRoleProps = {
  role: IRole;
  onDelete: (role: IRole) => boolean;
  onSave?: () => void;
};

export const DeleteOrganizationRole = ({ role, onDelete, onSave }: DeleteOrganizationRoleProps) => {
  const { t } = useT("os.idp.users");
  const [open, setOpen] = useState<boolean>(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={t("DELETE_ORGANIZATION_ROLE.REMOVE_ARIA_LABEL", { name: role.name })}
          className="inline-flex cursor-pointer items-center justify-center"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </DialogTrigger>
      <DialogContent className="mr-4 w-full max-w-[425px] rounded-md">
        <DialogHeader>
          <DialogTitle className="text-left text-lg font-semibold leading-7">
            {t("DELETE_ORGANIZATION_ROLE.TITLE")}
          </DialogTitle>
          <DialogDescription className="mb-6 mt-2 wrap-break-word text-left text-sm font-normal leading-5 text-medium-emphasis">
            {t("DELETE_ORGANIZATION_ROLE.DESCRIPTION")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 flex flex-row gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            {t("common:CANCEL")}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const wasRemoved = onDelete(role);
              setOpen(false);
              if (!wasRemoved) return;
              setTimeout(() => onSave?.(), 0);
            }}
          >
            {t("common:YES")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
