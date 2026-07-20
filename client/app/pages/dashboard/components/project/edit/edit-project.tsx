import { Dialog, DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import { Edit } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { EditProjectDialog } from "./edit-project-dialog";
import { useState } from "react";
import { useProjectStore } from "@seliseblocks/blocks-kit/store";

export function EditProject() {
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const { selectedProject } = useProjectStore();
  const { tenantGroupId, name } = selectedProject || {};

  return (
    <Dialog open={openEditDialog} onOpenChange={setOpenEditDialog}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Edit className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only">Edit</span>
        </Button>
      </DialogTrigger>
      <EditProjectDialog
        open={openEditDialog}
        onOpenChange={setOpenEditDialog}
        tenantGroupId={tenantGroupId || ""}
        currentName={name || ""}
      />
    </Dialog>
  );
}
