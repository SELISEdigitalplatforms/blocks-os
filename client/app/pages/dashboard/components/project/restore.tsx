import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Dialog, DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import { Button } from "@/components/ui-kits/button/button";
import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { useGetProjectStatus, useRestoreProject } from "@/hooks/use-project";
import { isErrorWithErrors, showErrorToast, showSuccessToast } from "@seliseblocks/blocks-kit/utils";

type RestoreProjectProps = {
  itemId: string;
};

export const RestoreProject = ({ itemId }: RestoreProjectProps) => {
  const { data: isSetupComplete } = useGetProjectStatus(itemId);
  const { mutateAsync, isPending } = useRestoreProject();
  const [open, setOpen] = useState<boolean>(false);

  if (isSetupComplete !== false) {
    return null;
  }

  const onClickHandler = async () => {
    try {
      const res = await mutateAsync({ itemId });
      if (res.isSuccess) {
        showSuccessToast({
          title: "Environment restore",
          description: "Setup has been re-triggered for this environment.",
        });
        setOpen(false);
      } else {
        showErrorToast({ errors: res.errors });
      }
    } catch (error) {
      if (isErrorWithErrors(error)) {
        showErrorToast({ errors: error.errors });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="flex items-center gap-2">
          <RotateCcw className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only">Restore</span>
        </Button>
      </DialogTrigger>
      <ConfirmationModal
        onCancel={() => setOpen(false)}
        onConfirm={onClickHandler}
        data={{
          dialogTitle: "Restore this environment?",
          dialogSubtitle: (
            <>
              <p>Setup hasn&apos;t completed for this environment.</p>
              <p>This will re-run the setup for this environment.</p>
            </>
          ),
          confirmButton: "Restore",
        }}
        buttonState={{ confirm: { disable: isPending } }}
      />
    </Dialog>
  );
};
