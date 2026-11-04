import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pushRuntimeService } from "../services/push-runtime.service";
import type {
  IPushDevicesQuery,
  IPushNotificationTestRequest,
  IPushTestRequest,
} from "../models/push.model";
import { PUSH_STATUS_KEY } from "./use-push-settings";

const DEVICES_KEY = "notification-push-devices";

/** Device counts and the last test per platform. */
export const usePushStatus = () =>
  useQuery({
    queryKey: [PUSH_STATUS_KEY],
    queryFn: () => pushRuntimeService.getStatus(),
  });

/** Test to the caller's own devices; the status refreshes because the last test changed. */
export const useSendTestPush = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [PUSH_STATUS_KEY, "test"],
    mutationFn: (request: IPushTestRequest) => pushRuntimeService.sendTest(request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PUSH_STATUS_KEY] }),
  });
};

/** Test of the unsaved notification draft (screen 4). */
export const useSendNotificationTest = () =>
  useMutation({
    mutationKey: [PUSH_STATUS_KEY, "test-notification"],
    mutationFn: (request: IPushNotificationTestRequest) =>
      pushRuntimeService.sendNotificationTest(request),
  });

export const usePushDevices = (query: IPushDevicesQuery) =>
  useQuery({
    queryKey: [
      DEVICES_KEY,
      query.platform ?? "all",
      query.search ?? "",
      query.page,
      query.pageSize,
    ],
    queryFn: () => pushRuntimeService.getDevices(query),
    placeholderData: (previous) => previous,
  });

export const useRemovePushDevice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [DEVICES_KEY, "remove"],
    mutationFn: (id: string) => pushRuntimeService.removeDevice(id),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [DEVICES_KEY] }),
        queryClient.invalidateQueries({ queryKey: [PUSH_STATUS_KEY] }),
      ]),
  });
};
