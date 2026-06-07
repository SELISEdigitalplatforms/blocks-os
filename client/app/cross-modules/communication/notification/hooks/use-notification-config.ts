import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationConfigService } from "../services/notification-config.service";
import {
  IGetNotificationConfigsPayload,
  ISaveNotificationConfigPayload,
} from "../models/notification-config.model";

export const notificationConfigsQueryKey = (options: IGetNotificationConfigsPayload) =>
  [
    "notification-configs",
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
      queryClient.invalidateQueries({ queryKey: ["notification-configs"] });
    },
  });
};

export const useDeleteNotificationConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["notification-config", "delete"],
    mutationFn: (itemId: string) => notificationConfigService.deleteNotificationConfig(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-configs"] });
    },
  });
};
