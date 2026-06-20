import { FilterControls, FilterToolbar, useSortQueryParams } from "@/components/filter-toolbar"
import { Badge } from "@/components/ui-kits/badge/badge"
import { Card, CardContent, CardHeader } from "@/components/ui-kits/card/card"
import { Pagination } from "@/components/ui-kits/pagination/pagination"
import { ScrollArea, ScrollBar } from "@/components/ui-kits/scroll-area/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table"
import { DUMMY_LOG_SERVICES } from "@blocks-lmt/constants/logs-dummy.constant"
import type { LogServiceRow } from "@blocks-lmt/models/log-entry.model"
import { filterLogServices } from "@blocks-lmt/utils/logs-filter.util"
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs"
import { useMemo } from "react"
import { useNavigate } from "react-router-dom"

type LogFilter = { search: string }

const useLogsFilterQueryParams = () => {
  const [queryParams, setQueryParams] = useQueryStates({
    search: parseAsString.withDefault(""),
    page: parseAsInteger.withDefault(0),
    pageSize: parseAsInteger.withDefault(10),
  })

  return { queryParams, setQueryParams }
}

const useLogSortQueryParams = () =>
  useSortQueryParams({ initial: { property: "Name", isDescending: false } })

const LogsTable = ({ data }: { data: LogServiceRow[] }) => {
  const navigate = useNavigate()
  const { sortQueryParams, setSortQueryParams } = useLogSortQueryParams()

  const columns = useMemo<ColumnDef<LogServiceRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: () => (
          <FilterControls.SortHeader
            id="Name"
            label="Service"
            value={sortQueryParams}
            onChange={setSortQueryParams}
          />
        ),
        cell: ({ row }) => (
          <div className="ml-2 font-medium sm:ml-0">{row.original.name}</div>
        ),
      },
      {
        accessorKey: "description",
        header: () => (
          <FilterControls.SortHeader
            id="Description"
            label="Description"
            value={sortQueryParams}
            onChange={setSortQueryParams}
          />
        ),
        cell: ({ row }) => (
          <div className="ml-2 text-muted-foreground sm:ml-0">
            {row.original.description}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: () => (
          <FilterControls.SortHeader
            id="Status"
            label="Status"
            value={sortQueryParams}
            onChange={setSortQueryParams}
          />
        ),
        cell: ({ row }) => (
          <div className="ml-2 sm:ml-0">
            <Badge variant="success" className="capitalize">
              {row.original.status}
            </Badge>
          </div>
        ),
      },
    ],
    [setSortQueryParams, sortQueryParams],
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const handleRowClick = (routeSlug: string) => {
    navigate(`/services/lmt/logs/${routeSlug}`)
  }

  return (
    <ScrollArea className="w-full">
      <Table className="text-sm">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="px-4 py-2 hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="font-bold text-medium-emphasis">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer text-medium-emphasis hover:bg-accent/50"
                onClick={() => handleRowClick(row.original.routeSlug)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={table.getAllColumns().length}
                className="h-24 text-center text-muted-foreground"
              >
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}

export const LogsOverview = () => {
  const { queryParams, setQueryParams } = useLogsFilterQueryParams()
  const { sortQueryParams } = useLogSortQueryParams()

  const filteredRows = useMemo(
    () =>
      filterLogServices({
        rows: DUMMY_LOG_SERVICES,
        search: queryParams.search,
        sort: sortQueryParams,
      }),
    [queryParams.search, sortQueryParams],
  )

  const paginatedRows = useMemo(() => {
    const start = queryParams.page * queryParams.pageSize
    return filteredRows.slice(start, start + queryParams.pageSize)
  }, [filteredRows, queryParams.page, queryParams.pageSize])

  const changeHandler = (key: string, value: unknown) => {
    setQueryParams((params) => ({
      ...params,
      [key]: value,
      page: 0,
    }))
  }

  const pageChangeHandler = (page: number) => {
    setQueryParams((params) => ({ ...params, page }))
  }

  const pageSizeChangeHandler = (pageSize: number) => {
    setQueryParams((params) => ({ ...params, page: 0, pageSize }))
  }

  const resetHandler = () => setQueryParams(null)

  return (
    <Card>
      <CardHeader>
        <FilterToolbar<LogFilter>
          filters={[{ key: "search", type: "SearchInput", label: "" }]}
          values={{ search: queryParams.search }}
          defaultValues={{ search: "" }}
          onChange={(key, value) => changeHandler(String(key), value)}
          onReset={resetHandler}
        />
      </CardHeader>
      <CardContent>
        <LogsTable data={paginatedRows} />
        {filteredRows.length > queryParams.pageSize && (
          <div className="mt-5 flex items-center md:justify-end">
            <Pagination
              page={queryParams.page}
              pageSize={queryParams.pageSize}
              pageSizeOptions={[10, 20, 50]}
              onChange={pageChangeHandler}
              onPageSizeChange={pageSizeChangeHandler}
              totalCount={filteredRows.length}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
