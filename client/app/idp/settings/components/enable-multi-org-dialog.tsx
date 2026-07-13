import ConfirmationModal from "@/components/confirmation-modal/confirmation-modal"
import { Dialog } from "@/components/ui-kits/dialog/dialog"

type EnableMultiOrgDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export const EnableMultiOrgDialog = ({
  open,
  onOpenChange,
  onConfirm,
}: EnableMultiOrgDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <ConfirmationModal
      data={{
        dialogTitle: "Enable multi-organization mode?",
        dialogSubtitle:
          "This cannot be turned off once saved. Creation workflows and provisioning settings will become editable, and your changes apply when you save.",
        confirmButton: "Enable",
      }}
      onConfirm={onConfirm}
      onCancel={() => onOpenChange(false)}
    />
  </Dialog>
)
