import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { EditProjectForm } from "./edit-project-form";

interface EditProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantGroupId: string;
  currentName: string;
}

export const EditProjectDialog = ({
  open,
  onOpenChange,
  tenantGroupId,
  currentName,
}: EditProjectDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>Update the project name.</DialogDescription>
        </DialogHeader>
        <EditProjectForm
          tenantGroupId={tenantGroupId}
          currentName={currentName}
          onAfterSubmit={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
};
