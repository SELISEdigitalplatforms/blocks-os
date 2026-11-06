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
import { useT, tStatic } from "@seliseblocks/genesis-os";

const KEY_GO_TO_TRACING = "RESTORED_LOGS_PANEL.GO_TO_TRACING";

const I18N_MODULE = "os.lmt";

interface RestoredLogsPanelProps {
  sourceType: TRACE_REQUEST_SOURCE_TYPE;
  restore: ReturnType<typeof useRestoreRequest>;
}

/** How long each tier usually takes, so a waiting reader knows whether to come back later. */
const EXPECTED_DURATION: Record<string, string> = {
  get [TRACE_REQUEST_SOURCE_TYPE.cold]() {
    return tStatic(I18N_MODULE, "RESTORED_LOGS_PANEL.3_5_HOURS");
  },
  get [TRACE_REQUEST_SOURCE_TYPE.archive]() {
    return tStatic(I18N_MODULE, "RESTORED_LOGS_PANEL.10_15_HOURS");
  },
};

const TIER_WORDS: Record<string, { noun: string; empty: string }> = {
  [TRACE_REQUEST_SOURCE_TYPE.cold]: {
    noun: "cold",
    get empty() {
      return tStatic(I18N_MODULE, "RESTORED_LOGS_PANEL.NO_COLD_LOGS_RESTORED");
    },
  },
  [TRACE_REQUEST_SOURCE_TYPE.archive]: {
    noun: "archived",
    get empty() {
      return tStatic(I18N_MODULE, "RESTORED_LOGS_PANEL.NO_ARCHIVED_LOGS_RESTORED");
    },
  },
};

const formatExpiry = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${date.getUTCDate()}`;
};

const serviceNamesOf = (service: {
  serviceNames?: string[] | null;
  serviceName?: string | null;
}) => {
  if (service.serviceNames?.length) return service.serviceNames;
  return service.serviceName ? [service.serviceName] : [];
};

type RunningRestoreCardProps = Readonly<{
  restore: RestoredLogsPanelProps["restore"];
  noun: string;
  windowLabel: string;
  duration: string;
  tracingHref: string;
}>;

function RunningRestoreCard({
  restore,
  noun,
  windowLabel,
  duration,
  tracingHref,
}: RunningRestoreCardProps) {
  const { t } = useT(I18N_MODULE);
  return (
    <Card className="min-h-[280px]">
      <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-10 text-center">
        <Loader2 className="mb-3 h-7 w-7 animate-spin text-primary" />
        <h3 className="text-base font-semibold tracking-tight">
          {t("RESTORED_LOGS_PANEL.A_RESTORE_IS_RUNNING", { noun })}
        </h3>
        <p className="mb-1 mt-2 max-w-md text-sm text-muted-foreground">
          {t("RESTORED_LOGS_PANEL.LOGS_APPEAR_HERE_AS_SOON", {
            value1: windowLabel ? `${windowLabel}. ` : "",
            value2: duration,
          })}
        </p>
        <p className="text-xs tabular-nums text-muted-foreground">
          {t("RESTORED_LOGS_PANEL.OF_FILES_PROCESSED", {
            processedFiles: restore.processedFiles,
            totalFiles: restore.totalFiles,
          })}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button size="sm" onClick={() => void restore.refresh()} disabled={restore.isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${restore.isRefreshing ? "animate-spin" : ""}`} />
            {restore.isRefreshing ? t("RESTORED_LOGS_PANEL.REFRESHING") : t("common:REFRESH")}
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to={tracingHref}>{t("RESTORED_LOGS_PANEL.VIEW_THIS_REQUEST_IN_TRACING")}</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

function FailedRestoreCard({
  noun,
  windowLabel,
  tracingHref,
}: Readonly<{ noun: string; windowLabel: string; tracingHref: string }>) {
  const { t } = useT(I18N_MODULE);
  return (
    <Card className="min-h-[280px]">
      <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-10 text-center">
        <AlertTriangle className="mb-3 h-7 w-7 text-destructive" />
        <h3 className="text-base font-semibold tracking-tight text-destructive">
          {t("RESTORED_LOGS_PANEL.THE_LAST_RESTORE_FAILED", { noun })}
        </h3>
        <p className="mb-5 mt-2 max-w-md text-sm text-muted-foreground">
          {t("RESTORED_LOGS_PANEL.NO_LOG_ROWS_WERE_RECOVERED", {
            value1: windowLabel ? ` for ${windowLabel}` : "",
          })}
        </p>
        <Button size="sm" asChild>
          <Link to={tracingHref}>{t(KEY_GO_TO_TRACING)}</Link>
        </Button>
      </div>
    </Card>
  );
}

// A range whose days held traces but no logs completes with nothing to list. Saying that is
// clearer than a filter toolbar sitting over an empty list.
function EmptyRestoreCard({
  windowLabel,
  tracingHref,
}: Readonly<{ windowLabel: string; tracingHref: string }>) {
  const { t } = useT(I18N_MODULE);
  return (
    <Card className="min-h-[280px]">
      <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-10 text-center">
        <History className="mb-3 h-7 w-7 text-muted-foreground" />
        <h3 className="text-base font-semibold tracking-tight">
          {t("RESTORED_LOGS_PANEL.THIS_RESTORE_HOLDS_NO_LOG")}
        </h3>
        <p className="mb-5 mt-2 max-w-md text-sm text-muted-foreground">
          {t("RESTORED_LOGS_PANEL.HAD_LOGS_STORED_FOR_THIS", {
            value1: windowLabel
              ? t("RESTORED_LOGS_PANEL.WINDOW_RESTORED_NONE_OF_DAYS", { windowLabel })
              : t("RESTORED_LOGS_PANEL.NONE_OF_THE_RESTORED_DAYS"),
          })}
        </p>
        <Button size="sm" variant="outline" asChild>
          <Link to={tracingHref}>{t(KEY_GO_TO_TRACING)}</Link>
        </Button>
      </div>
    </Card>
  );
}

/**
 * The restored cold or archive logs of the one request that tier has.
 *
 * Read-only by design: a restore costs money and covers traces and logs together, so it is
 * started, cancelled and retried on the Tracing page. Every state here that cannot show rows
 * points back there rather than offering a second way to spend.
 */
export function RestoredLogsPanel({ sourceType, restore }: RestoredLogsPanelProps) {
  const { t } = useT(I18N_MODULE);
  const { filter, pageSize, services, selectedServiceNames, selectedService, isServicesLoading } =
    useContext(LogsViewerContext);
  const basePath = useLmtBasePath();
  const [rowsPerPage, setRowsPerPage] = useState(pageSize);

  const words = TIER_WORDS[sourceType] ?? TIER_WORDS[TRACE_REQUEST_SOURCE_TYPE.cold];
  const tracingHref = `${basePath}/tracing?tab=${sourceType.toLowerCase()}`;
  const windowLabel = formatRestoreWindow(restore.startDate, restore.endDate);

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
    // The restore itself is part of the query: cold and archive are read through this same
    // panel, and page 5 of one is not page 5 of the other.
    requestId: restore.requestId,
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

  // A restore holds the rows of every service together, and a query naming no service at all
  // comes back with all of them. So a source whose service list is empty -- "My Service" on a
  // project that registered none -- must ask for nothing rather than ask unfiltered, or it
  // would answer with the managed services' rows under the other tab's name.
  const noServices = services.length === 0;

  const { data, isLoading, isFetching } = useGetRestoredLogs(query, {
    enabled: canRead && Boolean(restore.requestId) && !noServices,
  });

  const rows = (data?.data ?? []) as ILog[];
  const totalCount = data?.totalCount ?? 0;
  const loading = isLoading || isFetching;
  // The service selection counts as a filter, and it is narrowed from the moment the page opens
  // on its first service -- so an empty page under it has to read as a filtered result rather
  // than as a restore holding nothing.
  const everyServiceName = services.flatMap(serviceNamesOf);
  const isServiceNarrowed = selectedServiceNames.length < new Set(everyServiceName).size;
  const hasFilter = Boolean(search || level || startDate || endDate) || isServiceNarrowed;

  // Whose logs these are is settled before anything about the restore is: a source with no
  // services has nothing to show on any tier, which is what the live list says under the same
  // circumstances.
  if (isServicesLoading) {
    return (
      <Card className="flex min-h-[280px] items-center justify-center">
        <div className="flex flex-col items-center text-center text-muted-foreground">
          <Loader2 className="mb-3 h-6 w-6 animate-spin" />
          <p className="text-sm">{t("RESTORED_LOGS_PANEL.LOADING_SERVICES")}</p>
        </div>
      </Card>
    );
  }

  if (noServices) {
    return (
      <Card className="flex min-h-[280px] items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {t("RESTORED_LOGS_PANEL.NO_SERVICES_FOUND")}
        </p>
      </Card>
    );
  }

  // A failed lookup and an unrestored tier are indistinguishable in the data, so they are told
  // apart here: only one of them is worth offering a retry for, and only one of them is true.
  if (restore.hasError) {
    return (
      <Card className="min-h-[280px]">
        <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-10 text-center">
          <AlertTriangle className="mb-3 h-7 w-7 text-muted-foreground" />
          <h3 className="text-base font-semibold tracking-tight">
            {t("RESTORED_LOGS_PANEL.COULDN_T_READ_THE_RESTORE", { noun: words.noun })}
          </h3>
          <p className="mb-5 mt-2 max-w-md text-sm text-muted-foreground">
            {t("RESTORED_LOGS_PANEL.THE_STATUS_OF_THIS_PROJECT", { noun: words.noun })}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              size="sm"
              onClick={() => void restore.refresh()}
              disabled={restore.isRefreshing}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("RESTORED_LOGS_PANEL.TRY_AGAIN")}
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to={tracingHref}>{t(KEY_GO_TO_TRACING)}</Link>
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (restore.isLoading) {
    return (
      <Card className="flex min-h-[280px] items-center justify-center">
        <div className="flex flex-col items-center text-center text-muted-foreground">
          <Loader2 className="mb-3 h-6 w-6 animate-spin" />
          <p className="text-sm">
            {t("RESTORED_LOGS_PANEL.LOADING_LOG_STATUS", { noun: words.noun })}
          </p>
        </div>
      </Card>
    );
  }

  if (isRunning) {
    return (
      <RunningRestoreCard
        restore={restore}
        noun={words.noun}
        windowLabel={windowLabel}
        duration={EXPECTED_DURATION[sourceType]}
        tracingHref={tracingHref}
      />
    );
  }

  if (restore.status === TRACE_REQUEST_STATUS.failed) {
    return (
      <FailedRestoreCard noun={words.noun} windowLabel={windowLabel} tracingHref={tracingHref} />
    );
  }

  if (restore.status === TRACE_REQUEST_STATUS.cancelled) {
    return (
      <Card className="min-h-[280px]">
        <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-10 text-center">
          <Ban className="mb-3 h-7 w-7 text-muted-foreground" />
          <h3 className="text-base font-semibold tracking-tight">
            {t("RESTORED_LOGS_PANEL.THE_LAST_RESTORE_WAS_CANCELLED", { noun: words.noun })}
          </h3>
          <p className="mb-5 mt-2 max-w-md text-sm text-muted-foreground">
            {t("RESTORED_LOGS_PANEL.ITS_PARTIALLY_RESTORED_ROWS_WERE")}
          </p>
          <Button size="sm" asChild>
            <Link to={tracingHref}>{t(KEY_GO_TO_TRACING)}</Link>
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
            {t("RESTORED_LOGS_PANEL.A_RESTORE_REQUEST_BRINGS_BACK")}
          </p>
          <Button size="sm" asChild>
            <Link to={tracingHref}>{t(KEY_GO_TO_TRACING)}</Link>
          </Button>
        </div>
      </Card>
    );
  }

  if (restore.logRowsRestored === 0) {
    return <EmptyRestoreCard windowLabel={windowLabel} tracingHref={tracingHref} />;
  }

  const emptyRowsMessage = hasFilter
    ? t("RESTORED_LOGS_PANEL.NO_LOGS_MATCH_THESE_FILTERS")
    : t("RESTORED_LOGS_PANEL.NO_LOGS_IN_THIS_RESTORE");
  return (
    <Card>
      {restore.status === TRACE_REQUEST_STATUS.partialSuccess && (
        <div className="px-6 pt-6">
          <Banner variant="warning" title={t("RESTORED_LOGS_PANEL.PARTIALLY_RESTORED")}>
            {t("RESTORED_LOGS_PANEL.OF_FILES_COULD_NOT_BE", {
              failedFiles: restore.failedFiles,
              totalFiles: restore.totalFiles,
            })}
          </Banner>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-6 py-3 text-sm text-medium-emphasis">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">
          {words.noun === "cold"
            ? t("RESTORED_LOGS_PANEL.COLD_RESTORE")
            : t("RESTORED_LOGS_PANEL.ARCHIVE_RESTORE")}
        </span>
        {windowLabel && (
          <span className="tabular-nums text-high-emphasis">
            {t("RESTORED_LOGS_PANEL.UTC", { windowLabel })}
          </span>
        )}
        <span aria-hidden="true">•</span>
        <span className="tabular-nums">
          {t("RESTORED_LOGS_PANEL.LOG_ROWS", {
            value1: (restore.logRowsRestored ?? 0).toLocaleString("en-US"),
          })}
        </span>
        {formatExpiry(restore.expireAt) && (
          <>
            <span aria-hidden="true">•</span>
            <span>
              {t("RESTORED_LOGS_PANEL.EXPIRES", { expireAt: formatExpiry(restore.expireAt) })}
            </span>
          </>
        )}
        <Link
          to={tracingHref}
          className="ml-auto text-xs text-primary hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("RESTORED_LOGS_PANEL.VIEW_THIS_REQUEST_IN_TRACING")}
        </Link>
      </div>

      <CardHeader>
        <LogsFilterToolbar />
      </CardHeader>

      <CardContent>
        {loading && (
          <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("RESTORED_LOGS_PANEL.LOADING_RESTORED_LOGS")}
          </div>
        )}
        {!loading &&
          (rows.length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-1 text-center">
              <p className="text-sm font-medium text-high-emphasis">{emptyRowsMessage}</p>
              {hasFilter && (
                <p className="text-sm text-muted-foreground">
                  {t("RESTORED_LOGS_PANEL.WIDEN_THE_WINDOW_OR_CLEAR")}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col divide-y">
              {rows.map((log, index) => (
                <div
                  key={`${log.traceId}-${log.spanId}-${log.timestamp}-${index}`}
                  className="py-3"
                >
                  <LogItem log={log} />
                </div>
              ))}
            </div>
          ))}

        {!loading && totalCount > rowsPerPage && (
          <div className="mt-5 flex items-center md:justify-end">
            <Pagination
              page={page}
              pageSize={rowsPerPage}
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
