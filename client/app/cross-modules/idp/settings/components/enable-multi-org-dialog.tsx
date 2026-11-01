import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { useT } from "@seliseblocks/genesis-os";
import { Dialog } from "@/components/ui-kits/dialog/dialog";

type EnableMultiOrgDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export const EnableMultiOrgDialog = ({
  open,
  onOpenChange,
  onConfirm,
}: EnableMultiOrgDialogProps) => {
  const { t } = useT("os.idp.settings");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ConfirmationModal
        data={{
          dialogTitle: t("ENABLE_MULTI_ORG_DIALOG.TITLE"),
          dialogSubtitle: t("ENABLE_MULTI_ORG_DIALOG.SUBTITLE"),
          confirmButton: t("ENABLE_MULTI_ORG_DIALOG.ENABLE"),
        }}
        onConfirm={onConfirm}
        onCancel={() => onOpenChange(false)}
      />
    </Dialog>
  );
};
