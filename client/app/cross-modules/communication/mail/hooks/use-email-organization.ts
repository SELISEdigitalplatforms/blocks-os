import { useProjectStore } from "@seliseblocks/genesis-os";
import { parseAsString, useQueryState } from "nuqs";
import { useGetOrganizationConfig } from "@blocks-idp/iam/hooks/use-organization";
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
