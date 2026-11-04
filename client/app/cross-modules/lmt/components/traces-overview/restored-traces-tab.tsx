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
  useCancelRestoreRequest,
  useGetRequestId,
  useGetRestoredTraces,
  useGetTraceStatus,
  useStartArchiveTrace,
  useStartColdTrace,
} from "@blocks-lmt/hooks/use-trace";
import { AlertTriangle, Ban, History, Loader2, Plus, RefreshCw, X } from "lucide-react";
import { TracesFilterToolbar, useTracesFilterQueryParams } from "./traces-filter-toolbar";
import { CancelRestoreDialog } from "./cancel-restore-dialog";
import { RequestTracesModal } from "./request-traces-modal";
import { TracesList } from "./traces-list";
import type { ServiceOption, TraceFilter } from "./traces-filter-toolbar";
import { useT } from "@seliseblocks/genesis-os";

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
  const { t } = useT("os.lmt");
  const { user } = useAuthStore();
  const [requestId, setRequestId] = useState("");
  const [traceStatus, setTraceStatus] = useState("");
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const { mutateAsync: getRequestId } = useGetRequestId();
  const { mutateAsync: getTraceStatus } = useGetTraceStatus();
  const { mutateAsync: startColdTrace, isPending: isColdPending } = useStartColdTrace();
  const { mutateAsync: startArchiveTrace, isPending: isArchivePending } = useStartArchiveTrace();
  const { mutateAsync: cancelRestoreRequest, isPending: isCancelPending } =
    useCancelRestoreRequest();

  // Loads the request and its status without touching state; callers apply the result.
  const loadStatus = useCallback(async (): Promise<{ requestId?: string; status: string }> => {
    let requestId: string | undefined;
    try {
      const reqRes = await getRequestId({ ProjectKey: projectKey, SourceType: sourceType });
      if (!reqRes?.requestId) return { status: "NoRequest" };
      requestId = reqRes.requestId;
      const statusRes = await getTraceStatus({ RequestId: requestId, SourceType: sourceType });
      return { requestId, status: statusRes?.status || "NoRequest" };
    } catch {
      return { requestId, status: "NoRequest" };
    }
  }, [getRequestId, getTraceStatus, projectKey, sourceType]);

  const applyStatus = useCallback((result: { requestId?: string; status: string }) => {
    if (result.requestId) setRequestId(result.requestId);
    setTraceStatus(result.status);
    setIsLoadingStatus(false);
  }, []);

  const fetchStatus = useCallback(() => {
    setIsLoadingStatus(true);
    return loadStatus().then(applyStatus);
  }, [applyStatus, loadStatus]);

  // A new project or source type starts a fresh status load (the effect below runs it).
  const [statusSource, setStatusSource] = useState({ projectKey, sourceType });
  if (statusSource.projectKey !== projectKey || statusSource.sourceType !== sourceType) {
    setStatusSource({ projectKey, sourceType });
    if (projectKey) setIsLoadingStatus(true);
  }

  useEffect(() => {
    if (projectKey) {
      void loadStatus().then(applyStatus);
    }
  }, [applyStatus, loadStatus, projectKey]);

  const showTraces =
    traceStatus === TRACE_REQUEST_STATUS.completed ||
    traceStatus === TRACE_REQUEST_STATUS.partialSuccess;
  const showProcessingOverlay =
    traceStatus === TRACE_REQUEST_STATUS.pending || traceStatus === TRACE_REQUEST_STATUS.processing;

  const { data, isLoading, isFetching } = useGetRestoredTraces(
    {
      page: queryParams.page,
      pageSize: queryParams.pageSize,
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
      showErrorToast({ errors: t("RESTORED_TRACES_TAB.UNABLE_TO_PROCESS_THIS_REQUEST") });
    }
  };

  const handleCancelRequest = async () => {
    if (!requestId) return;

    try {
      const result = await cancelRestoreRequest({ RequestId: requestId });
      setShowCancelDialog(false);

      // The worker can finish between the page load and the click, in which case there was
      // nothing to stop — say so instead of implying the cancel worked.
      if (!result.cancelled) {
        showErrorToast({ errors: result.message });
      }

      await fetchStatus();
    } catch {
      setShowCancelDialog(false);
      showErrorToast({ errors: t("RESTORED_TRACES_TAB.UNABLE_TO_CANCEL_THIS_REQUEST") });
    }
  };

  if (isLoadingStatus) {
    return (
      <Card className="flex min-h-[280px] items-center justify-center">
        <div className="flex flex-col items-center text-center text-muted-foreground">
          <Loader2 className="mb-3 h-6 w-6 animate-spin" />
          <p className="text-sm">
            {t("RESTORED_TRACES_TAB.LOADING_TRACE_STATUS", { value1: sourceType.toLowerCase() })}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="relative min-h-[280px] overflow-hidden">
      {showProcessingOverlay && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 px-6 py-10 text-center backdrop-blur-xs">
          <Loader2 className="mb-3 h-7 w-7 animate-spin text-primary" />
          <h3 className="mb-2 text-base font-semibold">
            {t("RESTORED_TRACES_TAB.YOUR_REQUEST_FOR_TRACES_IS", {
              value1: sourceType.toLowerCase(),
            })}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("RESTORED_TRACES_TAB.IT_USUALLY_TAKES_HOURS_TO", {
              value1: sourceType === TRACE_REQUEST_SOURCE_TYPE.cold ? "3-5" : "10-15",
            })}
          </p>
          <div className="mt-5 flex items-center gap-2">
            <Button size="sm" onClick={() => void fetchStatus()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("common:REFRESH")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCancelDialog(true)}
              disabled={!requestId || isCancelPending}
            >
              <X className="mr-2 h-4 w-4" />
              {t("RESTORED_TRACES_TAB.CANCEL_REQUEST")}
            </Button>
          </div>
        </div>
      )}

      {traceStatus === "NoRequest" && (
        <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-10 text-center">
          <History className="mb-3 h-7 w-7 text-muted-foreground" />
          <h3 className="text-base font-semibold tracking-tight">
            {t("RESTORED_TRACES_TAB.NO_REQUEST_FOUND")}
          </h3>
          <p className="mb-5 mt-2 max-w-md text-sm text-muted-foreground">
            {t("RESTORED_TRACES_TAB.YOU_HAVEN_T_REQUESTED_ANY", {
              value1: sourceType.toLowerCase(),
            })}
          </p>
          <Button size="sm" onClick={() => setShowDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("RESTORED_TRACES_TAB.REQUEST_TRACES", { sourceType })}
          </Button>
        </div>
      )}

      {traceStatus === TRACE_REQUEST_STATUS.failed && (
        <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-10 text-center">
          <AlertTriangle className="mb-3 h-7 w-7 text-destructive" />
          <h3 className="text-base font-semibold tracking-tight text-destructive">
            {t("RESTORED_TRACES_TAB.REQUEST_FAILED")}
          </h3>
          <p className="mb-5 mt-2 text-sm text-muted-foreground">
            {t("RESTORED_TRACES_TAB.YOUR_PREVIOUS_REQUEST_FOR_TRACES", {
              value1: sourceType.toLowerCase(),
            })}
          </p>
          <Button size="sm" onClick={() => setShowDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("RESTORED_TRACES_TAB.TRY_AGAIN")}
          </Button>
        </div>
      )}

      {traceStatus === TRACE_REQUEST_STATUS.cancelled && (
        <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-10 text-center">
          <Ban className="mb-3 h-7 w-7 text-muted-foreground" />
          <h3 className="text-base font-semibold tracking-tight">
            {t("RESTORED_TRACES_TAB.REQUEST_CANCELLED")}
          </h3>
          <p className="mb-5 mt-2 max-w-md text-sm text-muted-foreground">
            {t("RESTORED_TRACES_TAB.YOU_CANCELLED_YOUR_LAST_REQUEST", {
              value1: sourceType.toLowerCase(),
            })}
          </p>
          <Button size="sm" onClick={() => setShowDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("RESTORED_TRACES_TAB.REQUEST_TRACES", { sourceType })}
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

      <CancelRestoreDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        sourceType={sourceType}
        isPending={isCancelPending}
        onConfirm={handleCancelRequest}
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
                {t("RESTORED_TRACES_TAB.NEW_REQUEST")}
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
