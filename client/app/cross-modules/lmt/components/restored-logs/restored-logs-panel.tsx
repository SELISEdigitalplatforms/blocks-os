import { Banner } from "@/components/ui-kits/banner/banner";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent, CardHeader } from "@/components/ui-kits/card/card";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { useLmtBasePath } from "@/hooks/use-lmt-base-path";
import {
  TRACE_REQUEST_SOURCE_TYPE,
  TRACE_REQUEST_STATUS,
} from "@blocks-lmt/constants/trace.constant";
import { useGetRestoredLogs } from "@blocks-lmt/hooks/use-log";
import type { useRestoreRequest } from "@blocks-lmt/hooks/use-restore-request";
import { AlertTriangle, Ban, History, Loader2, RefreshCw } from "lucide-react";
import { useContext, useMemo, useState } from "react";
import { Link } from "react-router";
import type { ILog } from "../../models/log.model";
import { formatRestoreWindow } from "../../utils/restore-window";
import { LogsFilterToolbar } from "../logs-header/logs-filter-toolbar";
import { LogItem } from "../logs-list/log-item";
import { LogsViewerContext } from "../logs-viewer/logs-viewer";

interface RestoredLogsPanelProps {
  sourceType: TRACE_REQUEST_SOURCE_TYPE;
  restore: ReturnType<typeof useRestoreRequest>;
}

/** How long each tier usually takes, so a waiting reader knows whether to come back later. */
const EXPECTED_DURATION: Record<string, string> = {
  [TRACE_REQUEST_SOURCE_TYPE.cold]: "3–5 hours",
  [TRACE_REQUEST_SOURCE_TYPE.archive]: "10–15 hours",
};

const TIER_WORDS: Record<string, { noun: string; empty: string }> = {
  [TRACE_REQUEST_SOURCE_TYPE.cold]: { noun: "cold", empty: "No cold logs restored" },
  [TRACE_REQUEST_SOURCE_TYPE.archive]: { noun: "archived", empty: "No archived logs restored" },
};

const formatExpiry = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${date.getUTCDate()}`;
};

/**
 * The restored cold or archive logs of the one request that tier has.
 *
 * Read-only by design: a restore costs money and covers traces and logs together, so it is
 * started, cancelled and retried on the Tracing page. Every state here that cannot show rows
 * points back there rather than offering a second way to spend.
 */
export function RestoredLogsPanel({ sourceType, restore }: RestoredLogsPanelProps) {
  const { filter, pageSize, selectedServiceNames, selectedService } =
    useContext(LogsViewerContext);
  const basePath = useLmtBasePath();
  const [rowsPerPage, setRowsPerPage] = useState(pageSize);

  const words = TIER_WORDS[sourceType] ?? TIER_WORDS[TRACE_REQUEST_SOURCE_TYPE.cold];
  const tracingHref = `${basePath}/tracing?tab=${sourceType.toLowerCase()}`;
  const window = formatRestoreWindow(restore.startDate, restore.endDate);

  const canRead =
    restore.status === TRACE_REQUEST_STATUS.completed ||
    restore.status === TRACE_REQUEST_STATUS.partialSuccess;
  const isRunning =
    restore.status === TRACE_REQUEST_STATUS.pending ||
    restore.status === TRACE_REQUEST_STATUS.processing;

  const { search = "", level = "", startDate = "", endDate = "" } = filter ?? {};

  // A narrowed filter can leave the reader on a page that no longer exists, which reads as an
  // empty restore. The page is held together with the query it belongs to, so any change to
  // what is being asked for reads as page 0 without an effect having to reset it.
  const queryShape = JSON.stringify({
    search,
    level,
    startDate,
    endDate,
    services: selectedServiceNames,
    rowsPerPage,
  });
  const [paging, setPaging] = useState({ shape: queryShape, page: 0 });
  const page = paging.shape === queryShape ? paging.page : 0;
  const setPage = (next: number) => setPaging({ shape: queryShape, page: next });

  const query = useMemo(
    () => ({
      requestId: restore.requestId,
      page,
      pageSize: rowsPerPage,
      // The primary service keeps the single-service form working for callers that rely on it.
      serviceName: selectedService?.serviceName ?? "",
      serviceNames: selectedServiceNames,
      search,
      filter: {
        ...(level && { level }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      },
    }),
    [
      endDate,
      level,
      page,
      rowsPerPage,
      restore.requestId,
      search,
      selectedService?.serviceName,
      selectedServiceNames,
      startDate,
    ],
  );

  const { data, isLoading, isFetching } = useGetRestoredLogs(query, {
    enabled: canRead && Boolean(restore.requestId),
  });

  const rows = (data?.data ?? []) as ILog[];
  const totalCount = data?.totalCount ?? 0;
  const loading = isLoading || isFetching;
  const hasFilter = Boolean(search || level || startDate || endDate);

  if (restore.isLoading) {
    return (
      <Card className="flex min-h-[280px] items-center justify-center">
        <div className="flex flex-col items-center text-center text-muted-foreground">
          <Loader2 className="mb-3 h-6 w-6 animate-spin" />
          <p className="text-sm">Loading {words.noun} log status...</p>
        </div>
      </Card>
    );
  }

  if (isRunning) {
    return (
      <Card className="min-h-[280px]">
        <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-10 text-center">
          <Loader2 className="mb-3 h-7 w-7 animate-spin text-primary" />
          <h3 className="text-base font-semibold tracking-tight">
            A {words.noun} restore is running
          </h3>
          <p className="mb-1 mt-2 max-w-md text-sm text-muted-foreground">
            {window ? `${window}. ` : ""}Logs appear here as soon as it finishes, which usually
            takes {EXPECTED_DURATION[sourceType]}.
          </p>
          <p className="text-xs tabular-nums text-muted-foreground">
            {restore.processedFiles} of {restore.totalFiles} files processed
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Button size="sm" onClick={() => void restore.refresh()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to={tracingHref}>View this request in Tracing</Link>
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (restore.status === TRACE_REQUEST_STATUS.failed) {
    return (
      <Card className="min-h-[280px]">
        <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-10 text-center">
          <AlertTriangle className="mb-3 h-7 w-7 text-destructive" />
          <h3 className="text-base font-semibold tracking-tight text-destructive">
            The last {words.noun} restore failed
          </h3>
          <p className="mb-5 mt-2 max-w-md text-sm text-muted-foreground">
            No log rows were recovered{window ? ` for ${window}` : ""}. Start a new request from
            Tracing to try the range again.
          </p>
          <Button size="sm" asChild>
            <Link to={tracingHref}>Go to Tracing</Link>
          </Button>
        </div>
      </Card>
    );
  }

  if (restore.status === TRACE_REQUEST_STATUS.cancelled) {
    return (
      <Card className="min-h-[280px]">
        <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-10 text-center">
          <Ban className="mb-3 h-7 w-7 text-muted-foreground" />
          <h3 className="text-base font-semibold tracking-tight">
            The last {words.noun} restore was cancelled
          </h3>
          <p className="mb-5 mt-2 max-w-md text-sm text-muted-foreground">
            Its partially restored rows were discarded, so there is nothing to read here. Request
            the range again from Tracing.
          </p>
          <Button size="sm" asChild>
            <Link to={tracingHref}>Go to Tracing</Link>
          </Button>
        </div>
      </Card>
    );
  }

  if (!canRead) {
    return (
      <Card className="min-h-[280px]">
        <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-10 text-center">
          <History className="mb-3 h-7 w-7 text-muted-foreground" />
          <h3 className="text-base font-semibold tracking-tight">{words.empty}</h3>
          <p className="mb-5 mt-2 max-w-md text-sm text-muted-foreground">
            A restore request brings back the traces and logs of a date range you pick. Requests
            are made on the Tracing page, and what comes back is readable here.
          </p>
          <Button size="sm" asChild>
            <Link to={tracingHref}>Go to Tracing</Link>
          </Button>
        </div>
      </Card>
    );
  }

  // A range whose days held traces but no logs completes with nothing to list. Saying that is
  // clearer than a filter toolbar sitting over an empty list.
  if (restore.logRowsRestored === 0) {
    return (
      <Card className="min-h-[280px]">
        <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-10 text-center">
          <History className="mb-3 h-7 w-7 text-muted-foreground" />
          <h3 className="text-base font-semibold tracking-tight">
            This restore holds no log rows
          </h3>
          <p className="mb-5 mt-2 max-w-md text-sm text-muted-foreground">
            {window ? `${window} was restored, but none of those days ` : "None of the restored days "}
            had logs stored for this project. Its traces may still be readable in Tracing.
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link to={tracingHref}>Go to Tracing</Link>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      {restore.status === TRACE_REQUEST_STATUS.partialSuccess && (
        <div className="px-6 pt-6">
          <Banner variant="warning" title="Partially restored">
            {restore.failedFiles} of {restore.totalFiles} files could not be read, so these results
            are incomplete. The gaps are listed on the request in Tracing.
          </Banner>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-6 py-3 text-sm text-medium-emphasis">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">
          {words.noun === "cold" ? "Cold" : "Archive"} restore
        </span>
        {window && <span className="tabular-nums text-high-emphasis">{window} (UTC)</span>}
        <span aria-hidden="true">•</span>
        <span className="tabular-nums">
          {(restore.logRowsRestored ?? 0).toLocaleString("en-US")} log rows
        </span>
        {formatExpiry(restore.expireAt) && (
          <>
            <span aria-hidden="true">•</span>
            <span>expires {formatExpiry(restore.expireAt)}</span>
          </>
        )}
        <Link
          to={tracingHref}
          className="ml-auto text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View this request in Tracing
        </Link>
      </div>

      <CardHeader>
        <LogsFilterToolbar />
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading restored logs...
          </div>
        ) : rows.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm font-medium text-high-emphasis">
              {hasFilter ? "No logs match these filters" : "No logs in this restore"}
            </p>
            {hasFilter && (
              <p className="text-sm text-muted-foreground">
                Widen the window or clear a filter to see more of the restored rows.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col divide-y">
            {rows.map((log, index) => (
              <div key={`${log.traceId}-${log.spanId}-${log.timestamp}-${index}`} className="py-3">
                <LogItem log={log} />
              </div>
            ))}
          </div>
        )}

        {!loading && totalCount > rowsPerPage && (
          <div className="mt-5 flex items-center md:justify-end">
            <Pagination
              page={page}
              pageSize={rowsPerPage}
              pageSizeOptions={[10, 20, 50]}
              onChange={setPage}
              onPageSizeChange={(next: number) => {
                setRowsPerPage(next);
                setPage(0);
              }}
              totalCount={totalCount}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
