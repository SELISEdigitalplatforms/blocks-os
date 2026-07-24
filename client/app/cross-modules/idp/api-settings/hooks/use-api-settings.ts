import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiSettingsService } from "../services/api-settings.service";
import {
  IGetApiEndpointsPayload,
  IUpdateApiEndpointPayload,
  IBulkUpdateApiEndpointsPayload,
  IRemoveApiEndpointsPayload,
} from "../models/api-endpoint.model";

const QUERY_KEY = "api-settings-endpoints";
const PAGE_SIZE = 20;

export const useGetApiEndpoints = (options: IGetApiEndpointsPayload) => {
  return useQuery({
    queryKey: [QUERY_KEY, options.projectKey, options.page, options.pageSize, options.filter],
    queryFn: () => apiSettingsService.getEndpoints(options),
    enabled: !!options.projectKey,
    staleTime: 0,
  });
};

export const useGetApiEndpointsInfinite = (
  options: Pick<IGetApiEndpointsPayload, "projectKey" | "filter">,
) => {
  return useInfiniteQuery({
    queryKey: [QUERY_KEY, "infinite", options.projectKey, options.filter],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiSettingsService.getEndpoints({
        ...options,
        page: pageParam as number,
        pageSize: PAGE_SIZE,
      }),
    getNextPageParam: (lastPage) => {
      const nextPage = lastPage.page + 1;
      return nextPage < lastPage.totalPages ? nextPage : undefined;
    },
    staleTime: 0,
  });
};

export const useUpdateApiEndpoint = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [QUERY_KEY, "update"],
    mutationFn: (payload: IUpdateApiEndpointPayload) => apiSettingsService.updateEndpoint(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
};

export const useBulkUpdateApiEndpoints = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [QUERY_KEY, "bulk-update"],
    mutationFn: (payload: IBulkUpdateApiEndpointsPayload) => apiSettingsService.bulkUpdate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
};

export const useRemoveApiEndpoints = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [QUERY_KEY, "remove"],
    mutationFn: (payload: IRemoveApiEndpointsPayload) =>
      apiSettingsService.removeEndpoints(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
};
