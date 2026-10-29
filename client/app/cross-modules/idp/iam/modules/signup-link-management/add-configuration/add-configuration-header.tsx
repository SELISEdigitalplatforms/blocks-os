import { useGetSignupLinkConfigurations } from "@blocks-idp/iam/hooks/use-signup-link-configurations";
import { isHttpErrorStatus } from "@/lib/http/http-error.util";
import { useSignupLinkConfigurationsQueryParams } from "../configurations/configurations-filter-toolbar";
import { AddConfiguration } from "./add-configuration";

/** Header action that disappears when the list query is forbidden (C3). */
export const AddConfigurationHeader = () => {
  const { queryParams } = useSignupLinkConfigurationsQueryParams();
  const { error } = useGetSignupLinkConfigurations({
    page: queryParams.page,
    pageSize: queryParams.pageSize,
    includeInactive: queryParams.includeInactive,
    search: queryParams.search || undefined,
  });
  if (isHttpErrorStatus(error, 403)) return null;
  return <AddConfiguration />;
};
