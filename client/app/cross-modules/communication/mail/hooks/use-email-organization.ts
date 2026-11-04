import { useProjectStore, useT } from "@seliseblocks/genesis-os";
import { parseAsString, useQueryState } from "nuqs";
import {
  useGetOrganizationById,
  useGetOrganizationConfig,
} from "@blocks-idp/iam/hooks/use-organization";
import { DEFAULT_ORGANIZATION_ID } from "@blocks-communication/mail/constants/organization";

/** The URL parameter that keeps the Email page's organization while on the page. */
export const EMAIL_ORGANIZATION_PARAM = "emailOrg";

/**
 * Whether the project uses organizations, and which one the Email page shows. The header picker
 * and the page read the same URL parameter, so they agree without sharing state. With multi-org
 * off the page is the Default organization's, whatever the URL says.
 */
export const useEmailOrganization = () => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const { data: organizationConfig, isLoading } = useGetOrganizationConfig(tenantId);
  const [selected, setSelectedOrganizationId] = useQueryState(
    EMAIL_ORGANIZATION_PARAM,
    parseAsString.withDefault(DEFAULT_ORGANIZATION_ID),
  );
  const isMultiOrgEnabled = organizationConfig?.isMultiOrgEnabled ?? false;

  return {
    isMultiOrgEnabled,
    isLoading,
    selectedOrganizationId: isMultiOrgEnabled ? selected : DEFAULT_ORGANIZATION_ID,
    setSelectedOrganizationId,
  };
};

/**
 * An organization's name for display: "Default organization" for the Default organization, which
 * is not an IAM record, else the IAM name (its id until that loads).
 */
export const useOrganizationName = (organizationId: string) => {
  const { t } = useT("os.communication.mail");
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const isDefault = !organizationId || organizationId === DEFAULT_ORGANIZATION_ID;
  const { data } = useGetOrganizationById({
    projectKey: tenantId,
    itemId: isDefault ? "" : organizationId,
  });
  return isDefault
    ? t("EMAIL_CONFIGURE.DEFAULT_ORGANIZATION")
    : (data?.organization?.name ?? organizationId);
};
