import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useGetLogs, useGetRestoredLogs } from "@blocks-lmt/hooks/use-log";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useContext, useMemo, useState } from "react";
import { timelineContext } from "../trace-details";
import { getLogFormatTimestamp, getLogLevelBadgeVariant } from "@blocks-lmt/utils";
import { Badge } from "@/components/ui-kits/badge/badge";
import { ILog } from "@blocks-lmt/models/log.model";
import { LogStackTrace } from "../../log-stack-trace";
import { FilterControls } from "@/components/filter-toolbar";
import { useSearchParams } from "react-router";
const LoadingSkelton = () => (
  <>
    {Array.from({ length: 10 }).map((_, index) => (
      <div key={index}>
        <Skeleton className="h-5 w-3/4 rounded" />
        <Skeleton className="my-2 h-5 w-full rounded" />
        <Skeleton className="h-5 w-full rounded-xl" />
      </div>
    ))}
  </>
);
const columns: ColumnDef<ILog>[] = [
  {
    id: "Trace",
    // Same anatomy as a row in the main logs list -- monospace timestamp, level chip, then the
    // message -- so moving between the two views does not mean relearning the layout.
    cell: ({ row }) => (
      <div className="flex w-full flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="shrink-0 text-xs tabular-nums text-medium-emphasis">
            {getLogFormatTimestamp(row.original.timestamp)}
          </span>
          <Badge
            variant={getLogLevelBadgeVariant(row.original.level)}
            className="w-[84px] shrink-0 py-0 text-[10px] uppercase tracking-wider"
          >
            {row.original.level}
          </Badge>
        </div>
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-high-emphasis">
          {row.original.message}
        </div>
        <LogStackTrace exception={row.original.exception} />
      </div>
    ),
    filterFn: (_value) => {
      return true;
    },
  },
];
export const TracingLog = () => {
  const { traceHistory } = useContext(timelineContext);
  const {
    current: { traceId, spanId, serviceName },
  } = traceHistory[traceHistory?.length - 1];
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get("requestId");
  const [search, setSearch] = useState<string>("");
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const logsPayload = {
    page: 0,
    pageSize: 200,
    serviceName,
    projectKey: tenantId,
    filter: {
      traceId: traceId,
      spanId: spanId,
    },
  };
  const normalLogs = useGetLogs(logsPayload, {
    enabled: !requestId,
  });
  const restoredLogs = useGetRestoredLogs(
    {
      ...logsPayload,
      requestId: requestId || "",
    },
    {
      enabled: Boolean(requestId),
    },
  );
  const { isLoading, isFetching, data } = requestId ? restoredLogs : normalLogs;
  const logs = useMemo(() => {
    if (!data) return [];
    return data.data.filter((item: ILog) => item.message.toLowerCase().includes(search));
  }, [data, search]);
  const table = useReactTable({
    data: logs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });
  if (isLoading || isFetching) return <LoadingSkelton />;
  if (data?.data.length == 0)
    return <div className="flex h-64 items-center justify-center border">No data</div>;
  if (!data) return null;
  return (
    <div>
      <FilterControls.SearchInput
        value={search}
        onChange={setSearch}
        className="h-fit w-full py-2.5"
      />
      <div className="mt-4 h-[calc(100vh-375px)] overflow-hidden">
        <div className="flex h-full flex-col gap-4 overflow-auto pr-1">
          {table.getFilteredRowModel().rows.map((row) => (
            <div key={row.id} className="flex flex-wrap border-b border-border/60 pb-4 last:border-b-0">
              {row
                .getVisibleCells()
                .map((cell) => flexRender(cell.column.columnDef.cell, cell.getContext()))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
