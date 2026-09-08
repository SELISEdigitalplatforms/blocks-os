import { FilterControls } from "@/components/filter-toolbar";
import { ScrollArea, ScrollBar } from "@/components/ui-kits/scroll-area/scroll-area";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { useLmtBasePath } from "@/hooks/use-lmt-base-path";
import { formatDurationMs, getTraceFormatTimestamp } from "@blocks-lmt/utils";
import { Badge } from "@/components/ui-kits/badge/badge";
import { TraceTree, getTraceStatus, getTypeColor } from "@blocks-lmt/models/trace.model";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { useTraceSortQueryParams } from "./traces-filter-toolbar";

const LoadingSkelton = () => (
  <div className="grid w-full gap-2">
    {Array.from({ length: 10 }).map((_, index) => (
      <Skeleton key={index} className="h-12 w-full rounded-xl" />
    ))}
  </div>
);

export function TracesList({
  data,
  isLoading,
  serviceLabels,
  hasActiveFilter,
  requestId,
}: {
  data: TraceTree[];
  isLoading: boolean;
  serviceLabels: Map<string, string>;
  hasActiveFilter: boolean;
  requestId?: string;
}) {
  const { sortQueryParams, setSortQueryParams } = useTraceSortQueryParams();
  const navigate = useNavigate();
  const LMT_BASE_PATH = useLmtBasePath();
  const columns = useMemo<ColumnDef<TraceTree>[]>(
    () => [
      {
        accessorKey: "entryPoint",
        header: () => (
          <FilterControls.SortHeader
            id="OperationName"
            label="Entry point"
            value={sortQueryParams}
            onChange={setSortQueryParams}
          />
        ),
        cell: ({ row }) => {
          const entryPoint = row.original.entryPoint;
          return (
            <div className="ml-2 flex w-[220px] flex-row items-center gap-2 sm:ml-0 sm:w-[320px]">
              <span className={`font-semibold uppercase ${getTypeColor(entryPoint.method)}`}>
                {entryPoint.method}
              </span>
              <span>{entryPoint.actionName}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        // Not sortable: the server sorts on the raw Mongo field, which is the span status,
        // while this column shows the HTTP code. A control that reordered by something other
        // than what is displayed would be worse than no control.
        header: () => <span className="font-bold text-medium-emphasis">Status</span>,
        cell: ({ row }) => {
          const status = getTraceStatus(row.original);
          return (
            <div className="ml-2 flex w-[90px] items-center sm:ml-0">
              <Badge variant={status.variant} className="py-0 tabular-nums">
                {status.label}
              </Badge>
            </div>
          );
        },
      },
      {
        accessorKey: "service",
        header: () => (
          <FilterControls.SortHeader
            id="ServiceName"
            label="Service"
            value={sortQueryParams}
            onChange={setSortQueryParams}
          />
        ),
        cell: ({ row }) => (
          <div className="ml-2 flex items-center sm:ml-0 sm:w-[180px]">
            {serviceLabels.get(row.original.serviceName) || row.original.serviceName}
          </div>
        ),
      },
      {
        accessorKey: "duration",
        header: () => (
          <FilterControls.SortHeader
            id="Duration"
            label="Duration"
            value={sortQueryParams}
            onChange={setSortQueryParams}
          />
        ),
        cell: ({ row }) => (
          <div className="ml-2 flex w-[180px] items-center tabular-nums sm:ml-0 sm:w-[150px]">
            {formatDurationMs(row.original.duration)}
          </div>
        ),
      },
      {
        accessorKey: "timestamp",
        header: () => (
          <FilterControls.SortHeader
            id="Timestamp"
            label="Timestamp"
            value={sortQueryParams}
            onChange={setSortQueryParams}
          />
        ),
        cell: ({ row }) => (
          <div className="ml-2 w-[200px] tabular-nums sm:ml-0">
            {getTraceFormatTimestamp(row.original.timestamp)}
          </div>
        ),
      },
    ],
    [serviceLabels, setSortQueryParams, sortQueryParams],
  );
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  if (isLoading) return <LoadingSkelton />;
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
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer text-medium-emphasis hover:bg-accent/50"
                onClick={() =>
                  navigate(
                    `${LMT_BASE_PATH}/tracing/${row.original.traceId}${
                      requestId ? `?requestId=${requestId}` : ""
                    }`,
                  )
                }
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
                {hasActiveFilter ? "No results found." : "No data found."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
