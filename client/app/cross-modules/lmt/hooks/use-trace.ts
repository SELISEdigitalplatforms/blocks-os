import { UseQueryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { lmtService } from "../services/lmt.service";
import {
  IGetRequestIdPayload,
  IGetTraceByTraceIdPayload,
  IGetTracesPayload,
  IGetTraceStatusPayload,
  ITraceRequestPayload,
} from "../models/trace.model";

export const useGetTraces = (option: IGetTracesPayload) => {
  return useQuery({
    queryKey: ["traces", option],
    queryFn: () => lmtService.trace.getTraces(option),
  });
};

export const useGetTraceById = (
  option: IGetTraceByTraceIdPayload,
  queryOptions?: Omit<UseQueryOptions<any, any, any, any>, "queryKey" | "queryFn">,
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
  queryOptions?: Omit<UseQueryOptions<any, any, any, any>, "queryKey" | "queryFn">,
) => {
  return useQuery({
    queryKey: ["restored-traces", option],
    queryFn: () => lmtService.trace.getRestoredTraces(option),
    ...queryOptions,
  });
};

export const useGetRestoredTraceById = (
  option: IGetTraceByTraceIdPayload,
  queryOptions?: Omit<UseQueryOptions<any, any, any, any>, "queryKey" | "queryFn">,
) => {
  return useQuery({
    queryKey: ["restored-trace", option],
    queryFn: () => lmtService.trace.getRestoredTraceByTraceId(option),
    ...queryOptions,
  });
};

export const useGetRestoredDataRetentionDays = (
  queryOptions?: Omit<UseQueryOptions<any, any, any, any>, "queryKey" | "queryFn">,
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
