import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import type { IDomain } from "@/models/project.model";
import { DomainForm } from "./domain-form";
import { useT } from "@seliseblocks/genesis-os";

interface DomainFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Pass an existing application to enter edit mode.
   * Omit (or pass null/undefined) for add mode.
   */
  application?: IDomain | null;
}

export const DomainFormDialog = ({ open, onOpenChange, application }: DomainFormDialogProps) => {
  const { t } = useT("os.dashboard");
  const isEditMode = !!application;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? t("DOMAIN_FORM_DIALOG.EDIT_DOMAIN") : t("DOMAIN_FORM_DIALOG.ADD_DOMAIN")}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? t("DOMAIN_FORM_DIALOG.UPDATE_THE_DOMAIN_CONFIGURATION")
              : t("DOMAIN_FORM_DIALOG.ADD_A_NEW_DOMAIN_TO")}
          </DialogDescription>
        </DialogHeader>
        <DomainForm application={application} onAfterSubmit={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
};
