import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationConfigService } from "../services/notification-config.service";
import {
  IGetNotificationConfigsPayload,
  ISaveNotificationConfigPayload,
} from "../models/notification-config.model";

const CONFIGS_QUERY_KEY = "notification-configs";

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

export const useSaveNotificationConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["notification-config", "save"],
    mutationFn: (payload: ISaveNotificationConfigPayload) =>
      notificationConfigService.saveNotificationConfig(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CONFIGS_QUERY_KEY] });
    },
  });
};

export const useDeleteNotificationConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["notification-config", "delete"],
    mutationFn: (itemId: string) => notificationConfigService.deleteNotificationConfig(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CONFIGS_QUERY_KEY] });
    },
  });
};
