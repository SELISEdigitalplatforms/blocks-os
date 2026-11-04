import { QueryKey, UseQueryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { lmtService } from "../services/lmt.service";
import {
  ICancelRestorePayload,
  IGetRequestIdPayload,
  IGetTraceByTraceIdPayload,
  IGetTracesPayload,
  IGetTraceStatusPayload,
  ITraceRequestPayload,
} from "../models/trace.model";

/** Extra react-query options a caller may pass; the hook owns queryKey and queryFn. */
type QueryOptionsFor<TFn extends (...args: never[]) => Promise<unknown>> = Omit<
  UseQueryOptions<Awaited<ReturnType<TFn>>, Error, Awaited<ReturnType<TFn>>, QueryKey>,
  "queryKey" | "queryFn"
>;

export const useGetTraces = (option: IGetTracesPayload) => {
  // The endpoint resolves the tenant from the request token rather than the payload, so the
  // active tenant keys the cache -- otherwise switching projects serves the previous one's traces.
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  return useQuery({
    queryKey: ["traces", tenantId, option],
    queryFn: () => lmtService.trace.getTraces(option),
  });
};

export const useGetTraceById = (
  option: IGetTraceByTraceIdPayload,
  queryOptions?: QueryOptionsFor<typeof lmtService.trace.getTraceByTraceId>,
) => {
  const enabled = Boolean(option.traceId);

  return useQuery({
    queryKey: ["trace", option],
    queryFn: () => lmtService.trace.getTraceByTraceId(option),
    enabled,
    ...queryOptions,
  });
};

export const useStartColdTrace = () => {
  return useMutation({
    mutationFn: (payload: ITraceRequestPayload) => lmtService.trace.startColdTrace(payload),
  });
};

export const useStartArchiveTrace = () => {
  return useMutation({
    mutationFn: (payload: ITraceRequestPayload) => lmtService.trace.startArchiveTrace(payload),
  });
};

export const useCancelRestoreRequest = () => {
  return useMutation({
    mutationFn: (payload: ICancelRestorePayload) => lmtService.trace.cancelRestoreRequest(payload),
  });
};

export const useGetTraceStatus = () => {
  return useMutation({
    mutationFn: (payload: IGetTraceStatusPayload) => lmtService.trace.getTraceStatus(payload),
  });
};

export const useGetRequestId = () => {
  return useMutation({
    mutationFn: (payload: IGetRequestIdPayload) => lmtService.trace.getRequestId(payload),
  });
};

export const useGetRestoredTraces = (
  option: IGetTracesPayload,
  queryOptions?: QueryOptionsFor<typeof lmtService.trace.getRestoredTraces>,
) => {
  return useQuery({
    queryKey: ["restored-traces", option],
    queryFn: () => lmtService.trace.getRestoredTraces(option),
    ...queryOptions,
  });
};

export const useGetRestoredTraceById = (
  option: IGetTraceByTraceIdPayload,
  queryOptions?: QueryOptionsFor<typeof lmtService.trace.getRestoredTraceByTraceId>,
) => {
  return useQuery({
    queryKey: ["restored-trace", option],
    queryFn: () => lmtService.trace.getRestoredTraceByTraceId(option),
    ...queryOptions,
  });
};

export const useGetRestoredDataRetentionDays = (
  queryOptions?: QueryOptionsFor<typeof lmtService.trace.getRestoredDataRetentionDays>,
) => {
  return useQuery({
    queryKey: ["restored-data-retention-days"],
    queryFn: () => lmtService.trace.getRestoredDataRetentionDays(),
    ...queryOptions,
  });
};

export const useGetBlocksServices = () => {
  return useQuery({
    queryKey: ["blocks-services"],
    queryFn: () => lmtService.trace.getBlocksServices(),
  });
};
