export const NOTIFICATION_ENDPOINTS = {
  GET_NOTIFICATIONS: `/api/Notifier/GetNotifications`,
  MARK_AS_READ: `/api/Notifier/MarkNotificationAsRead`,
  MARK_ALL_AS_READ: `/api/Notifier/MarkAllNotificationAsRead`,
  GET_CONFIGS: `/api/Notification/Gets`,
  GET_CONFIG: `/api/Notification/Get`,
  SAVE_CONFIG: `/api/Notification/Save`,
  DELETE_CONFIG: `/api/Notification/Delete`,
} as const;
