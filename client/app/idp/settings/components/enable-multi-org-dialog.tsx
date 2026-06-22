import ConfirmationModal from "@/components/confirmation-modal/confirmation-modal"
import { Dialog } from "@/components/ui-kits/dialog/dialog"
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast"
import { isErrorWithErrors } from "@/lib/error"
import { useSaveSettingsOrganizationConfig } from "@blocks-idp/settings/hooks/use-settings-config"
import type { ISettingsOrganizationConfig } from "@blocks-idp/settings/models/settings.model"
import { buildEnableMultiOrgPayload } from "@blocks-idp/settings/utils/organization-config-form"

type EnableMultiOrgDialogProps = {
  config: ISettingsOrganizationConfig
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const EnableMultiOrgDialog = ({
  config,
  open,
  onOpenChange,
}: EnableMultiOrgDialogProps) => {
  const { mutateAsync, isPending } = useSaveSettingsOrganizationConfig()

  const handleConfirm = async () => {
    try {
      const res = await mutateAsync(buildEnableMultiOrgPayload(config))
      if (!res.isSuccess) return showErrorToast({ errors: res.errors })
      showSuccessToast({ description: "Multi-organization mode enabled successfully" })
      onOpenChange(false)
    } catch (error) {
      if (isErrorWithErrors(error)) return showErrorToast({ errors: error.errors })
      showErrorToast({ errors: "Something went wrong" })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ConfirmationModal
        data={{
          dialogTitle: "Enable multi-organization mode?",
          dialogSubtitle:
            "This cannot be turned off later. Creation workflows and provisioning settings will become editable after you confirm.",
          confirmButton: isPending ? "Enabling..." : "Enable",
        }}
        onConfirm={handleConfirm}
        onCancel={() => onOpenChange(false)}
        buttonState={{ confirm: { disable: isPending } }}
      />
    </Dialog>
  )
}
