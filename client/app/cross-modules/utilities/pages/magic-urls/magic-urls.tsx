import { Card, CardContent, CardHeader } from "@/components/ui-kits/card/card"
import { Pagination } from "@/components/ui-kits/pagination/pagination"
import { useMagicUrlsFilterQueryParams, MagicUrlsFilterToolBar } from "./magic-urls-filter-toolbar"
import { MagicUrlsList } from "./magic-urls-list"
import { useProjectStore } from "@/store/useProjectStore"
import { useGetMagicUrls } from "@blocks-utilities/hooks/use-magic-url"

export const MagicUrls = () => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || ""
  const { queryParams, setQueryParams } = useMagicUrlsFilterQueryParams()

  const { data, isLoading, isFetching } = useGetMagicUrls({
    page: queryParams.page,
    pageSize: queryParams.pageSize,
    projectKey: tenantId,
    searchText: queryParams.search || undefined,
    status: queryParams.status || undefined,
    expiryDateRangeStartDate: queryParams.expiryStartDate || undefined,
    expiryDateRangeEndDate: queryParams.expiryEndDate || undefined,
    requestMethod: queryParams.requestMethod || undefined,
    type: queryParams.type || undefined,
  })

  const loading = isLoading || isFetching

  const handlePageChange = (page: number) => {
    setQueryParams((params) => ({ ...params, page }))
  }

  return (
    <Card>
      <CardHeader>
        <MagicUrlsFilterToolBar />
      </CardHeader>
      <CardContent>
        <MagicUrlsList data={data?.data || []} isLoading={loading} />
        {!loading && data && data.totalCount > queryParams.pageSize && (
          <div className="mt-5 flex items-center md:justify-end">
            <Pagination
              page={queryParams.page}
              pageSize={queryParams.pageSize}
              pageSizeOptions={[queryParams.pageSize]}
              onChange={handlePageChange}
              totalCount={data?.totalCount || 0}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
