import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { useProjectStore, useT } from "@seliseblocks/genesis-os";
import { useDeleteModel } from "@blocks-ai/hooks/use-aimodel";
type DeleteModelProps = {
  modelId: string;
  open: boolean;
  onOpenChange: (value: boolean) => void;
};
export const DeleteModel = ({ modelId, open, onOpenChange }: DeleteModelProps) => {
  const { t } = useT("os.ai");
  const projectKey = useProjectStore().selectedProject?.tenantId || "";
  const { mutateAsync } = useDeleteModel();
  const confirmHandler = async () => {
    try {
      if (!modelId) {
        showErrorToast({ errors: t("AIMODEL_DELETEMODEL_MODAL.SOMETHING_WENT_WRONG") });
        return onOpenChange(false);
      }
      const res = await mutateAsync({ modelId, project_key: projectKey });
      if (!res?.is_success) {
        return showErrorToast({
          errors:
            (res as unknown as { error?: string; detail?: string }).error ??
            (res as unknown as { detail?: string }).detail,
        });
      }
      showSuccessToast({ description: t("AIMODEL_DELETEMODEL_MODAL.MODEL_DELETED_SUCCESSFULLY") });
      onOpenChange(false);
    } catch (error) {
      if (isErrorWithErrors(error)) {
        return showErrorToast({ errors: error.errors });
      }
      return showErrorToast({ errors: t("AIMODEL_DELETEMODEL_MODAL.SOMETHING_WENT_WRONG") });
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onOpenChange(false);
      }}
    >
      <ConfirmationModal
        data={{
          dialogTitle: t("AIMODEL_DELETEMODEL_MODAL.DELETE_MODEL"),
          dialogSubtitle: t("AIMODEL_DELETEMODEL_MODAL.ARE_YOU_SURE_YOU_WANT"),
        }}
        onConfirm={confirmHandler}
        onCancel={() => onOpenChange(false)}
      />
    </Dialog>
  );
};
