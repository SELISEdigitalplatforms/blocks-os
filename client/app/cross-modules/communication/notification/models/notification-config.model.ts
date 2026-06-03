export const NOTIFICATION_CONFIG_SECRET_KEY = "notification" as const;

export interface INotificationConfigRow {
  itemId: string;
  createdDate?: string;
  lastUpdatedDate?: string;
  createdBy?: string;
  lastUpdatedBy?: string;
  name: string;
  channelToNotify: number;
  notificationType: number;
  enablePersistence: boolean;
  notifyMethod: string;
}

export interface IGetNotificationConfigsPayload {
  projectKey: string;
  page: number;
  pageSize: number;
  searchText?: string;
}

export interface IGetNotificationConfigsResponse {
  configurations: INotificationConfigRow[];
  totalCount: number;
}

export interface ISaveNotificationConfigPayload {
  itemId?: string;
  name: string;
  channelToNotify: number;
  notificationType: number;
  enablePersistence: boolean;
  notifyMethod: string;
  projectKey: string;
}

export interface ISaveNotificationConfigResponse {
  errors: null | unknown;
  isSuccess: boolean;
  itemId: string;
}
