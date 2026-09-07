import React, { useCallback, useEffect, useState } from "react";
import { showErrorToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent, CardHeader } from "@/components/ui-kits/card/card";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { useAuthStore } from "@seliseblocks/genesis-os/store";
import {
  TRACE_REQUEST_SOURCE_TYPE,
  TRACE_REQUEST_STATUS,
} from "@blocks-lmt/constants/trace.constant";
import {
  useGetRequestId,
  useGetRestoredTraces,
  useGetTraceStatus,
  useStartArchiveTrace,
  useStartColdTrace,
} from "@blocks-lmt/hooks/use-trace";
import { AlertTriangle, History, Loader2, Plus, RefreshCw } from "lucide-react";
import { TracesFilterToolbar, useTracesFilterQueryParams } from "./traces-filter-toolbar";
import { RequestTracesModal } from "./request-traces-modal";
import { TracesList } from "./traces-list";
import type { ServiceOption, TraceFilter } from "./traces-filter-toolbar";

interface RestoredTracesTabProps {
  sourceType: TRACE_REQUEST_SOURCE_TYPE;
  projectKey: string;
  queryParams: TraceFilter & {
    page: number;
    pageSize: number;
  };
  setQueryParams: ReturnType<typeof useTracesFilterQueryParams>["setQueryParams"];
  sortQueryParams: {
    property: string;
    isDescending: boolean;
  };
  serviceOptions: ServiceOption[];
  serviceLabels: Map<string, string>;
  selectedServiceNames: string[];
  hasActiveFilter: boolean;
}

export function RestoredTracesTab({
  sourceType,
  projectKey,
  queryParams,
  setQueryParams,
  sortQueryParams,
  serviceOptions,
  serviceLabels,
  selectedServiceNames,
  hasActiveFilter,
}: RestoredTracesTabProps) {
  const { user } = useAuthStore();
  const [requestId, setRequestId] = useState("");
  const [traceStatus, setTraceStatus] = useState("");
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [showDialog, setShowDialog] = useState(false);

  const { mutateAsync: getRequestId } = useGetRequestId();
  const { mutateAsync: getTraceStatus } = useGetTraceStatus();
  const { mutateAsync: startColdTrace, isPending: isColdPending } = useStartColdTrace();
  const { mutateAsync: startArchiveTrace, isPending: isArchivePending } = useStartArchiveTrace();

  const fetchStatus = useCallback(async () => {
    try {
      setIsLoadingStatus(true);
      const reqRes = await getRequestId({ ProjectKey: projectKey, SourceType: sourceType });
      if (reqRes?.requestId) {
        setRequestId(reqRes.requestId);
        const statusRes = await getTraceStatus({
          RequestId: reqRes.requestId,
          SourceType: sourceType,
        });
        setTraceStatus(statusRes?.status || "NoRequest");
      } else {
        setTraceStatus("NoRequest");
      }
    } catch {
      setTraceStatus("NoRequest");
    } finally {
      setIsLoadingStatus(false);
    }
  }, [getRequestId, getTraceStatus, projectKey, sourceType]);

  useEffect(() => {
    if (projectKey) {
      void fetchStatus();
    }
  }, [fetchStatus, projectKey]);

  const showTraces =
    traceStatus === TRACE_REQUEST_STATUS.completed ||
    traceStatus === TRACE_REQUEST_STATUS.partialSuccess;
  const showProcessingOverlay =
    traceStatus === TRACE_REQUEST_STATUS.pending || traceStatus === TRACE_REQUEST_STATUS.processing;

  const { data, isLoading, isFetching } = useGetRestoredTraces(
    {
      page: queryParams.page,
      pageSize: queryParams.pageSize,
      projectKey,
      search: queryParams.search,
      filter: {
        services: selectedServiceNames,
        excepts: ["blocks-lmt-api"],
      },
      sort: sortQueryParams,
      requestId,
    },
    { enabled: showTraces && !!requestId },
  );

  const loading = isLoading || isFetching;
  const isFormLoading = isColdPending || isArchivePending;

  const pageChangeHandler = (page: number) => {
    setQueryParams((params) => ({ ...params, page }));
  };

  const pageSizeChangeHandler = (pageSize: number) => {
    setQueryParams((params) => ({ ...params, page: 0, pageSize }));
  };

  const handleRequestTrace = async (payload: { startDate: string; endDate: string }) => {
    try {
      if (sourceType === TRACE_REQUEST_SOURCE_TYPE.cold) {
        await startColdTrace({ ...payload, projectKey, usermail: user?.email || "" });
      } else {
        await startArchiveTrace({ ...payload, projectKey, usermail: user?.email || "" });
      }
      setShowDialog(false);
      setTimeout(() => {
        void fetchStatus();
      }, 1000);
    } catch {
      showErrorToast({ errors: "Unable to process this request at the moment." });
    }
  };

  if (isLoadingStatus) {
    return (
      <Card className="flex min-h-[280px] items-center justify-center">
        <div className="flex flex-col items-center text-center text-muted-foreground">
          <Loader2 className="mb-3 h-6 w-6 animate-spin" />
          <p className="text-sm">Loading {sourceType.toLowerCase()} trace status...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="relative min-h-[280px] overflow-hidden">
      {showProcessingOverlay && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 px-6 py-10 text-center backdrop-blur-sm">
          <Loader2 className="mb-3 h-7 w-7 animate-spin text-primary" />
          <h3 className="mb-2 text-base font-semibold">
            Your request for {sourceType.toLowerCase()} traces is currently in progress
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            It usually takes {sourceType === TRACE_REQUEST_SOURCE_TYPE.cold ? "3-5" : "10-15"} hours
            to process.
          </p>
          <Button className="mt-5" size="sm" onClick={() => void fetchStatus()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      )}

      {traceStatus === "NoRequest" && (
        <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-10 text-center">
          <History className="mb-3 h-7 w-7 text-muted-foreground" />
          <h3 className="text-base font-semibold tracking-tight">No Request Found</h3>
          <p className="mb-5 mt-2 max-w-md text-sm text-muted-foreground">
            You haven't requested any {sourceType.toLowerCase()} traces yet.
          </p>
          <Button size="sm" onClick={() => setShowDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Request {sourceType} Traces
          </Button>
        </div>
      )}

      {traceStatus === TRACE_REQUEST_STATUS.failed && (
        <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-10 text-center">
          <AlertTriangle className="mb-3 h-7 w-7 text-destructive" />
          <h3 className="text-base font-semibold tracking-tight text-destructive">
            Request Failed
          </h3>
          <p className="mb-5 mt-2 text-sm text-muted-foreground">
            Your previous request for {sourceType.toLowerCase()} traces failed.
          </p>
          <Button size="sm" onClick={() => setShowDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      )}

      <RequestTracesModal
        open={showDialog}
        onOpenChange={setShowDialog}
        sourceType={sourceType}
        isPending={isFormLoading}
        onSubmit={handleRequestTrace}
      />

      {showTraces && (
        <>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex-1">
              <TracesFilterToolbar
                queryParams={queryParams}
                setQueryParams={setQueryParams}
                serviceOptions={serviceOptions}
                showTimeRange={false}
              />
            </div>
            <div className="ml-4">
              <Button onClick={() => setShowDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Request
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <TracesList
              data={data?.data || []}
              isLoading={loading}
              serviceLabels={serviceLabels}
              hasActiveFilter={hasActiveFilter}
              requestId={requestId}
            />
            {!loading && data && data.totalCount > queryParams.pageSize && (
              <div className="mt-5 flex items-center md:justify-end">
                <Pagination
                  page={queryParams.page}
                  pageSize={queryParams.pageSize}
                  pageSizeOptions={[10, 20, 50]}
                  onChange={pageChangeHandler}
                  onPageSizeChange={pageSizeChangeHandler}
                  totalCount={data.totalCount || 0}
                />
              </div>
            )}
          </CardContent>
        </>
      )}
    </Card>
  );
}
