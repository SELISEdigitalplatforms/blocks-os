import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { useProjectStore, useT } from "@seliseblocks/genesis-os";
import { useUpdateSsoCredentialStatus } from "@blocks-idp/authentication/hooks/use-sso";
import { ISsoProviderConfigurationWithMeta } from "@blocks-idp/authentication/models/sso.model";
type SSoProviderStatusToggleProps = {
  open: boolean;
  setOpen: (value: boolean) => void;
  configuration: ISsoProviderConfigurationWithMeta;
};
export const SSoProviderStatusToggle = ({
  open,
  setOpen,
  configuration,
}: SSoProviderStatusToggleProps) => {
  const { t } = useT("os.idp.auth");
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { mutateAsync } = useUpdateSsoCredentialStatus();
  const udpateStatus = async () => {
    try {
      if (!configuration.itemId || !tenantId)
        return showErrorToast({ errors: t("SSO_PROVIDER_STATUS_TOGGLE.ERROR_GENERIC") });
      const res = await mutateAsync({
        itemId: configuration.itemId,
        projectKey: tenantId,
        isEnabled: !configuration.isDisabled,
      });
      if (!res.isSuccess) return showErrorToast({ errors: res.errors });
      showSuccessToast({
        description: configuration.isDisabled
          ? t("SSO_PROVIDER_STATUS_TOGGLE.ENABLED_SUCCESS")
          : t("SSO_PROVIDER_STATUS_TOGGLE.DISABLED_SUCCESS"),
      });
      setOpen(false);
    } catch (error) {
      if (isErrorWithErrors(error)) return showErrorToast({ errors: error.errors });
      showErrorToast({ errors: t("SSO_PROVIDER_STATUS_TOGGLE.ERROR_GENERIC") });
    }
  };
  const isCurrentlyDisabled = configuration.isDisabled;
  const dialogTitle = isCurrentlyDisabled ? t("SSO_PROVIDER_STATUS_TOGGLE.ENABLE") : t("SSO_PROVIDER_STATUS_TOGGLE.DISABLE");
  const dialogSubtitle = isCurrentlyDisabled
    ? t("SSO_PROVIDER_STATUS_TOGGLE.ENABLE_CONFIRM")
    : t("SSO_PROVIDER_STATUS_TOGGLE.DISABLE_CONFIRM");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <ConfirmationModal
        data={{
          dialogTitle,
          dialogSubtitle,
        }}
        onCancel={() => setOpen(false)}
        onConfirm={() => udpateStatus()}
      />
    </Dialog>
  );
};
