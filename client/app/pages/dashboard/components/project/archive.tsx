import { Dialog, DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import { useDisableProject } from "@/hooks/use-project";
import { isErrorWithErrors } from "@seliseblocks/blocks-kit/utils";
import { useProjectStore } from "@seliseblocks/blocks-kit/store";
import { Archive } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  showErrorToast,
  showSuccessToast,
} from "@seliseblocks/blocks-kit/utils";
import { Button } from "@/components/ui-kits/button/button";
import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";

export const ArchiveProject = () => {
  const navigate = useNavigate();
  const projectKey = useProjectStore().selectedProject?.tenantId || "";
  const { mutateAsync, isPending } = useDisableProject({ projectKey });
  const onClickHandler = async () => {
    try {
      const res = await mutateAsync();
      if (res.isSuccess) {
        showSuccessToast({
          title: "Project delete",
          description: "Successfully deleted",
        });
        navigate("/app/console");
      } else {
        showErrorToast({ errors: res.errors });
      }
    } catch (error) {
      if (isErrorWithErrors(error)) {
        showErrorToast({ errors: error.errors });
      }
    }
  };
  const [open, setOpen] = useState<boolean>(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="destructive"
          size="sm"
          className="flex items-center gap-2">
          <Archive className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only">Delete</span>
        </Button>
      </DialogTrigger>
      <ConfirmationModal
        onCancel={() => setOpen(false)}
        onConfirm={onClickHandler}
        data={{
          dialogTitle: "Delete this environment?",
          dialogSubtitle: (
            <>
              <p>Are you sure you want to delete this environment?</p>
              <p>
                This will permanently delete the environment and you&apos;ll
                need to contact support to recover it.
              </p>
            </>
          ),
          confirmButton: "Delete",
        }}
        buttonState={{ confirm: { disable: isPending } }}
      />
    </Dialog>
  );
};
