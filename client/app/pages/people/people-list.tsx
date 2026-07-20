import { PeopleTable } from "./people-table"
import { Pagination } from "@/components/ui-kits/pagination/pagination"
import { PeopleFilterToolbar, usePeopleFilterQueryParams } from "./people-filter-toolbar"
import { Card, CardContent, CardHeader } from "@/components/ui-kits/card/card"
import { useGetPeople } from "@/hooks/use-people"

export const PeopleList = () => {
  const { queryParams, setQueryParams } = usePeopleFilterQueryParams()
  const { isLoading, isFetching, data } = useGetPeople({
    page: queryParams.page,
    pageSize: queryParams.pageSize,
    filter: queryParams.search,
    searchField: queryParams.searchField as "name" | "email",
  })

  const isViewerOwner = data?.isOwner ?? false

  const onPageChangeHandler = (page: number) => {
    setQueryParams((prev) => ({
      ...prev,
      page,
    }))
  }

  const onPageSizeChangeHandler = (pageSize: number) => {
    setQueryParams((prev) => ({
      ...prev,
      pageSize,
      page: 0,
    }))
  }

  const isPeopleLoading = isLoading || isFetching
  const peoples = data?.peoples || []
  const totalCount = data?.totalCount || 0

  return (
    <Card>
      <CardHeader>
        <PeopleFilterToolbar />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="bg-card text-card-foreground">
          <PeopleTable people={peoples} isLoading={isPeopleLoading} isViewerOwner={isViewerOwner} />
        </div>

        {!isPeopleLoading && peoples.length > 0 && (
          <div className="flex justify-end">
            <Pagination
              page={queryParams.page}
              pageSize={queryParams.pageSize}
              totalCount={totalCount}
              pageSizeOptions={[10, 20, 50, 100]}
              onChange={onPageChangeHandler}
              onPageSizeChange={onPageSizeChangeHandler}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
