import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pushSettingsService } from "../services/push-settings.service";
import type { ISavePushSettingsPayload } from "../models/notification-config.model";

const PUSH_SETTINGS_KEY = "notification-push-settings";

export const usePushSettings = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: [PUSH_SETTINGS_KEY],
    queryFn: () => pushSettingsService.getSettings(),
    enabled: options?.enabled ?? true,
  });

/** Mobile push counts as ready when a project id and a key are stored and it is switched on. */
export const isPushReady = (settings?: {
  projectId: string | null;
  enabled: boolean;
  hasKey: boolean;
}): boolean => !!settings && settings.enabled && settings.hasKey && !!settings.projectId;

export const useSavePushSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [PUSH_SETTINGS_KEY, "save"],
    mutationFn: (payload: ISavePushSettingsPayload) => pushSettingsService.saveSettings(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PUSH_SETTINGS_KEY] }),
  });
};

export const useSendTestPush = () =>
  useMutation({
    mutationKey: [PUSH_SETTINGS_KEY, "test"],
    mutationFn: () => pushSettingsService.sendTest(),
  });
