import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import type { IDomain } from "@seliseblocks/genesis-os/models";
import { DomainForm } from "./domain-form";

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
  const isEditMode = !!application;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Domain" : "Add Domain"}</DialogTitle>
          <DialogDescription>
            {isEditMode ? "Update the domain configuration." : "Add a new domain to this project."}
          </DialogDescription>
        </DialogHeader>
        <DomainForm application={application} onAfterSubmit={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
};
