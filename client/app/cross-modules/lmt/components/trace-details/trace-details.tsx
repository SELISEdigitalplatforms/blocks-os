import React, { createContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { BREADCRUMB_CUSTOM_TITLES } from "@/constants/breadcrumb-custom-title";
import { useLmtBasePath } from "@/hooks/use-scoped-path";
import { ArrowLeft, Download, GitBranch, PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import useIsMobile from "@/hooks/use-is-mobile";
import { useGetTraceById } from "@blocks-lmt/hooks/use-trace";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { TracingListBreadCrumb } from "./tracing-list-breadcrum/tracing-list-breadcrum";
import { TracingInsights } from "./tracing-insights/tracing-insights";
import { TracingDistributedTimeline } from "./tracing-distributed-timeline/tracing-distributed-timeline";
import { ActivityLogs } from "./activity-logs/activity-logs";
import { TraceTree } from "@blocks-lmt/models/trace.model";
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
  isPanelOpen: boolean;
  isLoading: boolean;
}>({
  traceHistory: [],
  setTraceHistory: () => {},
  selectedTrace: null,
  setSelectedTrace: () => {},
  isPanelOpen: true,
  isLoading: false,
});
const TraceDetailsEmptyState = ({
  traceId,
  isError,
}: {
  traceId: string
  isError: boolean
}) => (
  <Card className="mt-6 rounded-sm shadow-none">
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
      {traceId ? (
        <p className="mt-4 break-all font-mono text-xs text-low-emphasis">{traceId}</p>
      ) : null}
    </CardContent>
  </Card>
)
export const TraceDetails = ({
  id,
  breadcrumbIndex = 2,
  backHref,
}: {
  id: string
  breadcrumbIndex?: number
  backHref?: string
}) => {
  const navigate = useNavigate()
  const lmtBase = useLmtBasePath()
  const resolvedBackHref = backHref ?? `${lmtBase}/tracing`
  const isMobile = useIsMobile();
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [traceHistory, setTraceHistory] = useState<
    {
      rootId: string;
      current: TraceTree;
      root: TraceTree;
    }[]
  >([]);
  const { isLoading, isFetching, isError, data } = useGetTraceById({
    traceId: id,
  })
  const [selectedTrace, setSelectedTrace] = useState<TraceTree | null>(null);
  useEffect(() => {
    if (!data?.data) {
      setTraceHistory([])
      setSelectedTrace(null)
      return
    }

    const trace = data.data
    setTraceHistory([
      {
        root: trace,
        current: trace,
        rootId: trace.spanId,
      },
    ])
    setSelectedTrace(trace)
  }, [data?.data, id])
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
  BREADCRUMB_CUSTOM_TITLES[`${lmtBase}/tracing`] = "Tracing"
  if (id) {
    BREADCRUMB_CUSTOM_TITLES[`${lmtBase}/tracing/${id}`] = id
  }
  const selectedTraceHistory = traceHistory[traceHistory?.length - 1]
  const handleBack = () => navigate(resolvedBackHref)
  const isPending = isLoading || isFetching
  const hasTrace = Boolean(data?.data)
  const isEmpty = !isPending && !hasTrace
  const showTimelineLoading = isPending || (hasTrace && traceHistory.length === 0)
  return (
    <timelineContext.Provider
      value={{
        traceHistory,
        setTraceHistory,
        selectedTrace,
        setSelectedTrace,
        isPanelOpen,
        isLoading: showTimelineLoading,
      }}
    >
      {isPending ? (
        <Skeleton className="h-8 w-40" />
      ) : (
        <PageBreadcrumb breadcrumbIndex={breadcrumbIndex} listClassName="text-base sm:text-lg" />
      )}
      <div className="flex items-center justify-between md:py-6">
        {isPending ? (
          <Skeleton className="h-8 w-1/3" />
        ) : (
          <div className="flex items-center">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleBack}>
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <h1 className="ml-2 break-all text-lg font-semibold md:ml-4 md:text-2xl">
              {hasTrace ? (
                <>
                  {data?.data?.entryPoint?.method}{" "}
                  <span className="text-low-emphasis">{data?.data?.entryPoint?.actionName}</span>
                </>
              ) : (
                <span className="text-low-emphasis">{id}</span>
              )}
            </h1>
          </div>
        )}
        {isPending ? (
          <Skeleton className="h-8 w-40" />
        ) : hasTrace ? (
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="default"
              variant="outline"
              className="shadow-none"
              onClick={downloadJSONFile}
            >
              <Download className="h-4 w-4 lg:mr-2" />
              <span className="sr-only lg:not-sr-only">Download JSON</span>
            </Button>
          </div>
        ) : null}
      </div>
      {isEmpty ? (
        <TraceDetailsEmptyState traceId={id} isError={isError} />
      ) : (
      <div className="mt-6 flex w-full flex-col gap-6 md:flex-row">
        <div className={`${isPanelOpen ? "w-full md:w-[68%]" : "w-full"}`}>
          <Card className="h-min rounded-sm shadow-none">
            <CardHeader>
              <div className="flex flex-col items-start justify-between sm:flex-row sm:items-center">
                <CardTitle className="text-xl">
                  {isPending ? <Skeleton className="h-6 w-28" /> : "Timeline"}
                </CardTitle>
                {isPending ? (
                  <Skeleton className="h-6 w-64" />
                ) : (
                  <div
                    className={`mt-2 flex flex-col items-start gap-2 md:mt-0 md:flex-row md:items-center md:justify-end md:gap-10`}
                  >
                    <div className="flex flex-col items-start text-[12px] font-medium text-low-emphasis sm:items-center lg:flex-row">
                      <span>Duration </span>
                      <span className="ml-1 break-all text-high-emphasis">
                        {selectedTraceHistory?.current?.duration.toFixed(2)}ms
                      </span>
                    </div>
                    <div className="flex flex-col items-start text-[12px] font-medium text-low-emphasis sm:items-center lg:flex-row">
                      <span>Trace ID </span>
                      <span className="ml-1 break-all text-high-emphasis">
                        {data?.data?.traceId}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div></div>
              <TracingListBreadCrumb />
            </CardHeader>
            <CardContent className="text-base">
              <div className="flex flex-col">
                <div className="mb-[16px]">
                  <TracingDistributedTimeline />
                </div>
                <div className="mb-[16px] flex items-center justify-end">
                  {!isMobile && (
                    <Button
                      variant="outline"
                      className="h-10 w-10 p-0"
                      onClick={() => setIsPanelOpen(!isPanelOpen)}
                    >
                      {isPanelOpen ? (
                        <PanelRightClose width={20} height={20} />
                      ) : (
                        <PanelRightOpen width={20} height={20} />
                      )}
                    </Button>
                  )}
                </div>
                <ActivityLogs />
              </div>
            </CardContent>
          </Card>
        </div>
        {isPanelOpen && (
          <div
            className={`w-full overflow-hidden transition-all duration-500 ease-in-out md:w-[32%] ${
              isPanelOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
            }`}
          >
            <TracingInsights />
          </div>
        )}
      </div>
      )}
    </timelineContext.Provider>
  );
};
export default TraceDetails;
