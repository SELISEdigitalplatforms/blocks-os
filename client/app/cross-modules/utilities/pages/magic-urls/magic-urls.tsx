import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { ConfigsTableShell } from "@/components/configs-table-shell/configs-table-shell";
import { EmptyState } from "@/components/ui-kits/empty-state";
import { useMagicUrlsFilterQueryParams, MagicUrlsFilterToolBar } from "./magic-urls-filter-toolbar";
import { MagicUrlsList } from "./magic-urls-list";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useGetMagicUrlConfigs } from "@blocks-utilities/hooks/use-magic-url-config";
import { Link2 } from "lucide-react";

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
  const configurations = data?.configurations || [];
  const isEmpty = !loading && configurations.length === 0;

  const handlePageChange = (page: number) => {
    setQueryParams((params) => ({ ...params, page }));
  };

  if (isEmpty) {
    return (
      <EmptyState
        icon={Link2}
        title="No configurations found"
        description="Use Add Configuration to create one."
      />
    );
  }

  return (
    <ConfigsTableShell
      toolbar={<MagicUrlsFilterToolBar />}
      footer={
        <Pagination
          page={queryParams.page}
          pageSize={queryParams.pageSize}
          pageSizeOptions={[queryParams.pageSize]}
          onChange={handlePageChange}
          totalCount={data?.totalCount ?? 0}
        />
      }
    >
      <MagicUrlsList configurations={configurations} isLoading={loading} />
    </ConfigsTableShell>
  );
};
