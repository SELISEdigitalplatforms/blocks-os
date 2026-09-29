import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { useGetSignupLinkConfigurations } from "@blocks-idp/iam/hooks/use-signup-link-configurations";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { isHttpErrorStatus } from "@/lib/http/http-error.util";
import {
  ConfigurationsFilterToolbar,
  useSignupLinkConfigurationsQueryParams,
} from "./configurations-filter-toolbar";
import { ConfigurationsList } from "./configurations-list";

export const SignupLinkConfigurations = () => {
  const { queryParams, setQueryParams } = useSignupLinkConfigurationsQueryParams();
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { data, isLoading, isFetching, isError, error, refetch, isFetched } =
    useGetSignupLinkConfigurations(
      {
        page: queryParams.page,
        pageSize: queryParams.pageSize,
        includeInactive: queryParams.includeInactive,
        search: queryParams.search || undefined,
      },
      { enabled: !!tenantId },
    );

  const loading = !tenantId || isLoading || (isFetching && !isFetched);
  const items = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const isForbidden = isHttpErrorStatus(error, 403);
  const hasActiveFilters = Boolean(queryParams.search) || queryParams.includeInactive;

  return (
    <Card>
      <CardContent>
        {!isForbidden && (
          <div className="mb-4">
            <ConfigurationsFilterToolbar />
          </div>
        )}
        <ConfigurationsList
          items={items}
          isLoading={loading}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={() => setQueryParams(null)}
          isForbidden={isForbidden}
          isError={isError && !isForbidden}
          onRetry={() => {
            void refetch();
          }}
        />
        {!loading && !isForbidden && !isError && totalCount > queryParams.pageSize && (
          <div className="mt-5 flex items-center md:justify-end">
            <Pagination
              compact
              page={queryParams.page}
              onChange={(page) => setQueryParams((params) => ({ ...params, page }))}
              totalCount={totalCount}
              pageSizeOptions={[queryParams.pageSize]}
              pageSize={queryParams.pageSize}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};
