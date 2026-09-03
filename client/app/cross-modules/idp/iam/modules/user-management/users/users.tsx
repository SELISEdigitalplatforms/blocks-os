import { Card, CardContent } from "@/components/ui-kits/card/card";
import { UsersTable } from "./users-table";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { useGetUsers } from "@blocks-idp/iam/hooks/use-user";
import {
  useGetAllEnabledOrganizations,
  useGetOrganizationConfig,
} from "@blocks-idp/iam/hooks/use-organization";
import { useProjectStore } from "@seliseblocks/genesis-os";
import {
  UsersDateFilters,
  UsersSearchFilter,
  useUsersFilterQueryParams,
  useUsersSortQueryParams,
} from "./users-filter-toolbar";

export const Users = () => {
  const { queryParams, setQueryParams } = useUsersFilterQueryParams();
  const { sortQueryParams } = useUsersSortQueryParams();
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { data: orgConfig } = useGetOrganizationConfig(tenantId);
  const { data: organizations = [] } = useGetAllEnabledOrganizations(tenantId, {
    enabled:
      orgConfig?.isMultiOrgEnabled === true || orgConfig?.isMultiOrgEnabled === false,
  });
  const hasOrganizationOptions = organizations.length > 0;
  const organizationIds =
    orgConfig?.isMultiOrgEnabled === true && hasOrganizationOptions
      ? (queryParams.organizationIds ?? [])
      : [];
  const canFilterByRoles =
    hasOrganizationOptions &&
    (orgConfig?.isMultiOrgEnabled !== true || organizationIds.length > 0);
  const roles = canFilterByRoles ? (queryParams.roles ?? []) : [];

  const searchText =
    queryParams["selected-filter"] === "email"
      ? queryParams.email
      : queryParams.name;

  const { isLoading, isFetching, data } = useGetUsers({
    page: queryParams.page,
    pageSize: queryParams.pageSize,
    projectKey: tenantId,
    query: searchText,
    filter: {
      email: queryParams.email,
      name: queryParams.name,
      joinedOn: queryParams["joinedOn-start"] || undefined,
      lastLogin: queryParams["lastLogin-start"] || undefined,
      lastUpdatedDate: queryParams["lastUpdatedDate-start"] || undefined,
      ...(organizationIds.length > 0 ? { organizationIds } : {}),
      ...(roles.length > 0 ? { roles } : {}),
    },
    sort: sortQueryParams,
  });

  const onPageChangeHandler = (page: number) => {
    setQueryParams((params) => ({ ...params, page }));
  };

  const isUserLoading = isLoading || isFetching;

  return (
    <Card>
      <CardContent>
        <div
          data-testid="users-filter-row"
          className="mb-6 flex flex-row items-start justify-between gap-3"
        >
          <div data-testid="users-search-filter-slot" className="min-w-0 flex-1">
            <UsersSearchFilter />
          </div>
          <div data-testid="users-advanced-filter-slot" className="shrink-0">
            <UsersDateFilters />
          </div>
        </div>
        <UsersTable users={data?.data || []} isLoading={isUserLoading} />
        {!isUserLoading && data && data.totalCount > queryParams.pageSize && (
          <div className="mt-5 flex items-center md:justify-end">
            <Pagination
              compact
              page={queryParams.page}
              pageSize={queryParams.pageSize}
              totalCount={data?.totalCount || 0}
              pageSizeOptions={[5, 10]}
              onChange={onPageChangeHandler}
              onPageSizeChange={(pageSize) => setQueryParams((params) => ({ ...params, pageSize, page: 1 }))}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};
