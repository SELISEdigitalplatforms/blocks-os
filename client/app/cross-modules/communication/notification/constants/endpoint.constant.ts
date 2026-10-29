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

/** Push settings are owned by the OS server (relative URLs). */
export const PUSH_SETTINGS_ENDPOINTS = {
  GET: "/api/PushSettings/Get",
  SAVE: "/api/PushSettings/Save",
} as const;

/** Push runtime (status, test, devices) is served by the logic service. */
export const PUSH_RUNTIME_ENDPOINTS = {
  STATUS: () => logicNotifier("push-status"),
  TEST: () => logicNotifier("push-test"),
  TEST_NOTIFICATION: () => logicNotifier("push-test/notification"),
  DEVICES: (query: string) => logicNotifier(`devices/all?${query}`),
  DEVICE: (id: string) => logicNotifier(`devices/all/${encodeURIComponent(id)}`),
} as const;
