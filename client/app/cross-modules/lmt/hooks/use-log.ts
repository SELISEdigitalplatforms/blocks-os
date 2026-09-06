import { UseQueryOptions, useQuery } from "@tanstack/react-query";
import { IGetLiveLogsPayload, IGetLogsPayload, IGetRestoredLogsPayload } from "../models/log.model";
import { lmtService } from "../services/lmt.service";

export const useGetLogs = (
  option: IGetLogsPayload,
  queryOptions?: Omit<UseQueryOptions<any, any, any, any>, "queryKey" | "queryFn">,
) => {
  return useQuery({
    queryKey: ["logs", option],
    queryFn: () => lmtService.log.getLogs({ ...option }),
    ...queryOptions,
  });
};

export const useGetRestoredLogs = (
  option: IGetRestoredLogsPayload,
  queryOptions?: Omit<UseQueryOptions<any, any, any, any>, "queryKey" | "queryFn">,
) => {
  return useQuery({
    queryKey: ["restored-logs", option],
    queryFn: () => lmtService.log.getRestoredLogs({ ...option }),
    ...queryOptions,
  });
};

export const useGetLiveLogs = (option: IGetLiveLogsPayload) => {
  return useQuery({
    queryKey: ["live-logs", option],
    queryFn: () => lmtService.log.getLiveLog(option),
  });
};

export const useGetBlocksServices = () => {
  return useQuery({
    queryKey: ["blocks-services"],
    queryFn: () => lmtService.log.getBlocksServices(),
  });
};
