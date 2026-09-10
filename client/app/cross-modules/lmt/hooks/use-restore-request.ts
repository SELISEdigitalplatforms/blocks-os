import { TRACE_REQUEST_SOURCE_TYPE } from "@blocks-lmt/constants/trace.constant";
import { useQuery } from "@tanstack/react-query";
import { lmtService } from "../services/lmt.service";

/** No restore has been asked for on this tier, or the one that was is no longer readable. */
export const NO_RESTORE_REQUEST = "NoRequest";

interface UseRestoreRequestParams {
  sourceType: TRACE_REQUEST_SOURCE_TYPE;
  projectKey: string;
  /** Off for hot, which has no request behind it and should cost no round trip. */
  enabled?: boolean;
}

interface RestoreRequestState {
  requestId: string;
  status: string;
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  startDate?: string;
  endDate?: string;
  expireAt?: string;
  logRowsRestored?: number;
  traceRowsRestored?: number;
}

const NOTHING: RestoreRequestState = {
  requestId: "",
  status: NO_RESTORE_REQUEST,
  totalFiles: 0,
  processedFiles: 0,
  failedFiles: 0,
};

/**
 * The one restore request a tier has, and the window it covers.
 *
 * A restore is not trace-specific -- it brings back the traces and the logs of the same days --
 * so the Logs page reads the request the Tracing page created rather than owning one of its own.
 * Everything needed to describe the window comes from the status response, because this page
 * never sees the request being made.
 */
export const useRestoreRequest = ({
  sourceType,
  projectKey,
  enabled = true,
}: UseRestoreRequestParams) => {
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["restore-request", sourceType, projectKey],
    queryFn: async (): Promise<RestoreRequestState> => {
      const request = await lmtService.trace.getRequestId({
        ProjectKey: projectKey,
        SourceType: sourceType,
      });

      if (!request?.requestId) return NOTHING;

      const status = await lmtService.trace.getTraceStatus({
        RequestId: request.requestId,
        SourceType: sourceType,
      });

      return {
        requestId: request.requestId,
        status: status?.status || NO_RESTORE_REQUEST,
        totalFiles: status?.totalFiles ?? 0,
        processedFiles: status?.processedFiles ?? 0,
        failedFiles: status?.failedFiles ?? 0,
        startDate: status?.startDate,
        endDate: status?.endDate,
        expireAt: status?.expireAt,
        logRowsRestored: status?.logRowsRestored,
        traceRowsRestored: status?.traceRowsRestored,
      };
    },
    enabled: enabled && Boolean(projectKey),
    retry: false,
  });

  return {
    ...(data ?? NOTHING),
    /**
     * A lookup that failed is kept apart from a tier nobody has restored. They read the same in
     * the data -- neither has a request -- but only one of them is worth offering a retry for,
     * and telling someone their completed restore does not exist is the worse mistake.
     */
    hasError: isError,
    /** The first read, which the page has nothing to show during. */
    isLoading,
    /** A re-read of something already on screen, which must not replace it with a spinner. */
    isRefreshing: isFetching && !isLoading,
    refresh: async () => {
      await refetch();
    },
  };
};
