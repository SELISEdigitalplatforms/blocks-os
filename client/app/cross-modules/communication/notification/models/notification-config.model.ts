// DEADCODE 2026-07-29: no references in client or e2e; commented pending review
// export const NOTIFICATION_CONFIG_SECRET_KEY = "notification" as const;

/** Optional built-in metadata. Rows from older servers lack every field: treat them as custom and enabled. */
export interface INotificationConfigBuiltInFields {
  isBuiltIn?: boolean;
  isDisabled?: boolean;
  description?: string | null;
  /** 0 None, 1 Low, 2 Medium, 3 High */
  importance?: number;
  /** 0 None, 1 Job, 2 Progress, 3 Alert, 4 Security, 5 Access */
  kind?: number;
  sourceService?: string | null;
  consumerAppRecommendation?: string | null;
  consumerAppNote?: string | null;
}

export interface INotificationConfigRow extends INotificationConfigBuiltInFields {
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

export interface ISaveNotificationConfigPayload extends INotificationConfigBuiltInFields {
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
