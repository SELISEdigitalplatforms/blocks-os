import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationConfigService } from "../services/notification-config.service";
import {
  IGetNotificationConfigsPayload,
  ISaveNotificationConfigPayload,
} from "../models/notification-config.model";

const CONFIGS_QUERY_KEY = "notification-configs";
const CONFIG_QUERY_KEY = "notification-config";

export const notificationConfigsQueryKey = (options: IGetNotificationConfigsPayload) =>
  [
    CONFIGS_QUERY_KEY,
    options.projectKey,
    options.page,
    options.pageSize,
    options.searchText ?? "",
  ] as const;

export const useGetNotificationConfigs = (
  options: IGetNotificationConfigsPayload,
  queryOptions?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: notificationConfigsQueryKey(options),
    queryFn: () => notificationConfigService.getNotificationConfigs(options),
    enabled: !!options.projectKey && (queryOptions?.enabled ?? true),
  });
};

export const useGetNotificationConfig = (itemId: string) =>
  useQuery({
    queryKey: [CONFIG_QUERY_KEY, itemId],
    queryFn: () => notificationConfigService.getNotificationConfig(itemId),
    enabled: !!itemId,
  });

export const useSaveNotificationConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [CONFIG_QUERY_KEY, "save"],
    mutationFn: (payload: ISaveNotificationConfigPayload) =>
      notificationConfigService.saveNotificationConfig(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CONFIGS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [CONFIG_QUERY_KEY] });
    },
  });
};

export const useDeleteNotificationConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [CONFIG_QUERY_KEY, "delete"],
    mutationFn: (itemId: string) => notificationConfigService.deleteNotificationConfig(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CONFIGS_QUERY_KEY] });
    },
  });
};
