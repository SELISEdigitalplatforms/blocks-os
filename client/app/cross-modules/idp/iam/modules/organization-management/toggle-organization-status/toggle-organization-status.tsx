import { useT } from "@seliseblocks/genesis-os";
import { Button } from "@/components/ui-kits/button/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { IOrganization } from "@blocks-idp/iam/models/organization";
import { useUpdateOrganization } from "@blocks-idp/iam/hooks/use-organization";

type ToggleOrganizationStatusProps = {
  organization: IOrganization;
  onClose: () => void;
};

export const ToggleOrganizationStatus = ({
  organization,
  onClose,
}: ToggleOrganizationStatusProps) => {
  const { t } = useT("os.idp.organizations");
  const { mutateAsync, isPending } = useUpdateOrganization();

  // isDisabled is optional on the OS organization model, so normalise it to a boolean.
  const isEnabling = !!organization.isDisabled;
  const title = isEnabling
    ? t("TOGGLE_ORGANIZATION_STATUS.TITLE_ENABLE")
    : t("TOGGLE_ORGANIZATION_STATUS.TITLE_DISABLE");
  const description = isEnabling
    ? t("TOGGLE_ORGANIZATION_STATUS.DESCRIPTION_ENABLE", { name: organization.name })
    : t("TOGGLE_ORGANIZATION_STATUS.DESCRIPTION_DISABLE", { name: organization.name });
  const actionLabel = isEnabling
    ? t("TOGGLE_ORGANIZATION_STATUS.ENABLE")
    : t("TOGGLE_ORGANIZATION_STATUS.DISABLE");
  const actioningLabel = isEnabling
    ? t("TOGGLE_ORGANIZATION_STATUS.ENABLING")
    : t("TOGGLE_ORGANIZATION_STATUS.DISABLING");

  const handleConfirm = async () => {
    try {
      const res = await mutateAsync({
        itemId: organization.itemId,
        name: organization.name,
        isEnable: isEnabling,
      });
      if (!res.isSuccess) {
        showErrorToast({ errors: res.errors });
        return;
      }
      showSuccessToast({
        description: isEnabling
          ? t("TOGGLE_ORGANIZATION_STATUS.ENABLED_SUCCESS")
          : t("TOGGLE_ORGANIZATION_STATUS.DISABLED_SUCCESS"),
      });
      onClose();
    } catch (error: unknown) {
      if (error && typeof error === "object" && "errors" in error) {
        showErrorToast({ errors: error.errors });
      }
    }
  };

  return (
    <DialogContent>
      <DialogHeader className="mb-4">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogFooter className="mt-6">
        <DialogTrigger asChild>
          <Button className="min-w-[80px]" variant="outline" disabled={isPending}>
            {t("common:CANCEL")}
          </Button>
        </DialogTrigger>
        <Button
          className="min-w-[80px]"
          variant={isEnabling ? "default" : "destructive"}
          onClick={handleConfirm}
          disabled={isPending}
        >
          {isPending ? actioningLabel : actionLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};
