import { Card, CardContent, CardHeader } from "@/components/ui-kits/card/card";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { useMagicUrlsFilterQueryParams, MagicUrlsFilterToolBar } from "./magic-urls-filter-toolbar";
import { MagicUrlsList } from "./magic-urls-list";
import { useProjectStore } from "@/store/useProjectStore";
import { useGetMagicUrlConfigs } from "@blocks-utilities/hooks/use-magic-url-config";

export const MagicUrls = () => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const { queryParams, setQueryParams } = useMagicUrlsFilterQueryParams();

  const { data, isLoading, isFetching } = useGetMagicUrlConfigs({
    projectKey: tenantId,
    page: queryParams.page,
    pageSize: queryParams.pageSize,
    searchText: queryParams.search || undefined,
  });

  const loading = isLoading || isFetching;

  const handlePageChange = (page: number) => {
    setQueryParams((params) => ({ ...params, page }));
  };

  return (
    <Card>
      <CardHeader>
        <MagicUrlsFilterToolBar />
      </CardHeader>
      <CardContent>
        <MagicUrlsList configurations={data?.configurations || []} isLoading={loading} />
        {!loading && data && data.totalCount > queryParams.pageSize && (
          <div className="mt-5 flex items-center md:justify-end">
            <Pagination
              page={queryParams.page}
              pageSize={queryParams.pageSize}
              pageSizeOptions={[queryParams.pageSize]}
              onChange={handlePageChange}
              totalCount={data.totalCount}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};
