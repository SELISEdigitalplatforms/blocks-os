import React, { createContext, useState } from "react";
import PageBreadcrumb, { BreadcrumbTitles } from "@/components/breadcrumb/breadcrumb";
import { useLmtBasePath } from "@/hooks/use-lmt-base-path";
import { Download, GitBranch } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { useGetRestoredTraceById, useGetTraceById } from "@blocks-lmt/hooks/use-trace";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { TraceStoryView } from "./trace-story";
import { TraceTree } from "@blocks-lmt/models/trace.model";
import { useSearchParams } from "react-router";
export const timelineContext = createContext<{
  traceHistory: {
    rootId: string;
    current: TraceTree;
    root: TraceTree;
  }[];
  setTraceHistory: React.Dispatch<
    React.SetStateAction<
      {
        rootId: string;
        current: TraceTree;
        root: TraceTree;
      }[]
    >
  >;
  selectedTrace: TraceTree | null;
  setSelectedTrace: React.Dispatch<React.SetStateAction<TraceTree | null>>;
  isLoading: boolean;
  requestId?: string;
}>({
  traceHistory: [],
  setTraceHistory: () => {},
  selectedTrace: null,
  setSelectedTrace: () => {},
  isLoading: false,
});
const TraceDetailsEmptyState = ({ traceId, isError }: { traceId: string; isError: boolean }) => (
  <Card className="rounded-sm shadow-none">
    <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <GitBranch className="h-6 w-6 text-muted-foreground" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold text-high-emphasis">
        {isError ? "Unable to load trace" : "Trace not found"}
      </h2>
      <p className="mt-2 max-w-md text-sm text-medium-emphasis">
        {isError
          ? "Something went wrong while fetching trace details. Please try again in a moment."
          : `No trace data exists for this ID in the current project. The trace may have expired, or it may not have been recorded yet.`}
      </p>
      {traceId ? <p className="mt-4 break-all text-xs text-low-emphasis">{traceId}</p> : null}
    </CardContent>
  </Card>
);

const getTraceBreadcrumbLabel = (
  id: string,
  hasTrace: boolean,
  entryPoint?: { method?: string; actionName?: string },
  includeMethod = false,
) => {
  if (!hasTrace) return id;
  const actionName = entryPoint?.actionName;
  if (!actionName) return id;
  if (!includeMethod || !entryPoint?.method) return actionName;
  return `${actionName} (${entryPoint.method})`;
};

export const TraceDetails = ({
  id,
  breadcrumbIndex = 2,
  logsTraceBreadcrumbHref,
  breadcrumbTitles,
}: {
  id: string;
  breadcrumbIndex?: number;
  logsTraceBreadcrumbHref?: string;
  /** Titles for ancestor segments owned by the routing page (e.g. the logs crumbs). */
  breadcrumbTitles?: BreadcrumbTitles;
}) => {
  const lmtBase = useLmtBasePath();
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get("requestId");
  const [traceHistory, setTraceHistory] = useState<
    {
      rootId: string;
      current: TraceTree;
      root: TraceTree;
    }[]
  >([]);
  const normalTrace = useGetTraceById({ traceId: id }, { enabled: !requestId && Boolean(id) });
  const restoredTrace = useGetRestoredTraceById(
    { traceId: id, requestId: requestId || "" },
    { enabled: Boolean(requestId && id) },
  );
  const { isLoading, isFetching, isError, data } = requestId ? restoredTrace : normalTrace;
  const [selectedTrace, setSelectedTrace] = useState<TraceTree | null>(null);
  // A new trace (or trace id) resets the drill-down history to that trace's root.
  const [historySource, setHistorySource] = useState<{
    trace: TraceTree | undefined;
    id: typeof id;
  } | null>(null);
  if (historySource === null || historySource.trace !== data?.data || historySource.id !== id) {
    setHistorySource({ trace: data?.data, id });
    const trace = data?.data;
    if (!trace) {
      setTraceHistory([]);
      setSelectedTrace(null);
    } else {
      setTraceHistory([
        {
          root: trace,
          current: trace,
          rootId: trace.spanId,
        },
      ]);
      setSelectedTrace(trace);
    }
  }
  const downloadJSONFile = () => {
    if (!data?.data) return;
    const jsonString = JSON.stringify(data.data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `tracing-details-${data.data.traceId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };
  const isPending = isLoading || isFetching;
  const hasTrace = Boolean(data?.data);
  const isEmpty = !isPending && !hasTrace;
  const showTimelineLoading = isPending || (hasTrace && traceHistory.length === 0);
  const entryPoint = data?.data?.entryPoint;
  const traceLabel = getTraceBreadcrumbLabel(id, hasTrace, entryPoint, true);
  const resolvedBreadcrumbTitles: BreadcrumbTitles = {
    ...breadcrumbTitles,
    [`${lmtBase}/tracing`]: "Tracing",
    ...(id ? { [`${lmtBase}/tracing/${id}`]: traceLabel } : {}),
    ...(logsTraceBreadcrumbHref ? { [logsTraceBreadcrumbHref]: traceLabel } : {}),
  };
  return (
    <timelineContext.Provider
      value={{
        traceHistory,
        setTraceHistory,
        selectedTrace,
        setSelectedTrace,
        isLoading: showTimelineLoading,
        requestId: requestId || undefined,
      }}
    >
      <div className="mb-4 flex items-center justify-between gap-4 sm:mb-6">
        {isPending ? (
          <>
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-8 w-40" />
          </>
        ) : (
          <>
            <PageBreadcrumb
              breadcrumbIndex={breadcrumbIndex}
              customTitles={resolvedBreadcrumbTitles}
            />
            {hasTrace ? (
              <Button
                size="default"
                variant="outline"
                className="shrink-0 shadow-none"
                onClick={downloadJSONFile}
              >
                <Download className="h-4 w-4 lg:mr-2" />
                <span className="sr-only lg:not-sr-only">Download JSON</span>
              </Button>
            ) : null}
          </>
        )}
      </div>
      {isEmpty ? <TraceDetailsEmptyState traceId={id} isError={isError} /> : <TraceStoryView />}
    </timelineContext.Provider>
  );
};
export default TraceDetails;
