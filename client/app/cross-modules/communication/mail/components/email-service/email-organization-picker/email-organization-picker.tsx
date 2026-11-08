import { useProjectStore, useT } from "@seliseblocks/genesis-os";
import { Label } from "@/components/ui-kits/label/label";
import { OrganizationCombobox } from "@blocks-idp/iam/components/organization-combobox";
import { useEmailOrganization } from "@blocks-communication/mail/hooks/use-email-organization";

const PICKER_ID = "email-organization-picker";

/**
 * The Email page's organization picker, in the page header next to Add Configuration. Shown only
 * in multi-org projects; the Default organization comes first, then the enabled organizations.
 */
export function EmailOrganizationPicker() {
  const { t } = useT("os.communication.mail");
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const { isMultiOrgEnabled, selectedOrganizationId, setSelectedOrganizationId } =
    useEmailOrganization();

  if (!isMultiOrgEnabled) {
    return null;
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Label htmlFor={PICKER_ID} className="sr-only">
        {t("EMAIL_CONFIGURE.ORGANIZATION")}
      </Label>
      <div className="w-56 max-w-full">
        <OrganizationCombobox
          id={PICKER_ID}
          projectKey={tenantId}
          value={selectedOrganizationId}
          onValueChange={(organizationId) => void setSelectedOrganizationId(organizationId)}
          excludeNotEnabled
          defaultOptionLabel={t("EMAIL_CONFIGURE.DEFAULT_ORGANIZATION")}
          defaultOptionDescription={t("EMAIL_CONFIGURE.DEFAULT_ORGANIZATION_DESCRIPTION")}
          errorMessage={t("EMAIL_CONFIGURE.ORGANIZATIONS_LOAD_FAILED")}
        />
      </div>
    </div>
  );
}
