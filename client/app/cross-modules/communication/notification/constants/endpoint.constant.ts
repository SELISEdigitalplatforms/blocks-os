import { getRuntimeEnv } from "@/lib/runtime-env";

const trimTrailingSlash = (value: string) => value.replace(/\/$/, "");

/** Notifier endpoints of the logic service; the host is read when a request is made. */
const logicNotifier = (path: string) =>
  `${trimTrailingSlash(getRuntimeEnv("BLOCKS_LOGIC_BASE_URL"))}/api/Notifier/${path}`;

export const NOTIFICATION_ENDPOINTS = {
  GET_NOTIFICATIONS: `/api/Notifier/GetNotifications`,
  MARK_AS_READ: `/api/Notifier/MarkNotificationAsRead`,
  MARK_ALL_AS_READ: `/api/Notifier/MarkAllNotificationAsRead`,
  GET_CONFIGS: `/api/Notification/Gets`,
  GET_CONFIG: `/api/Notification/Get`,
  SAVE_CONFIG: `/api/Notification/Save`,
  DELETE_CONFIG: `/api/Notification/Delete`,
} as const;

export const PUSH_SETTINGS_ENDPOINTS = {
  SETTINGS: () => logicNotifier("push-settings"),
  TEST: () => logicNotifier("push-settings/test"),
} as const;
