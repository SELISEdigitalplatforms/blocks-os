import { Pagination } from "@/components/ui-kits/pagination/pagination"
import { ConfigsTableShell } from "@/components/configs-table-shell/configs-table-shell"
import { useMagicUrlsFilterQueryParams, MagicUrlsFilterToolBar } from "./magic-urls-filter-toolbar"
import { MagicUrlsList } from "./magic-urls-list"
import { useProjectStore } from "@seliseblocks/blocks-kit"
import { useGetMagicUrlConfigs } from "@blocks-utilities/hooks/use-magic-url-config"

export const MagicUrls = () => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || ""
  const { queryParams, setQueryParams } = useMagicUrlsFilterQueryParams()

  const { data, isLoading, isFetching } = useGetMagicUrlConfigs({
    projectKey: tenantId,
    page: queryParams.page,
    pageSize: queryParams.pageSize,
    searchText: queryParams.search || undefined,
  })

  const loading = isLoading || isFetching

  const handlePageChange = (page: number) => {
    setQueryParams((params) => ({ ...params, page }))
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
      <MagicUrlsList configurations={data?.configurations || []} isLoading={loading} />
    </ConfigsTableShell>
  )
}
