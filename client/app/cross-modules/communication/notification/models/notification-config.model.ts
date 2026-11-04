import type { IPushOptions, PushPlatform } from "./push.model";

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

/** A narrowing rule: keeps only receivers with a live subscription for this context. Never adds receivers. */
export interface INotificationSubscriptionFilter {
  context: string;
  actionName: string;
  value: string;
}

/** Who receives the notification. The project always comes from the sending call, never from here. */
export interface INotificationAudience {
  /** 0 Affected users only, 1 All users, 2 Selected */
  level: number;
  /** 0 Any, 1 All: how the Selected rules combine */
  match: number;
  userIds: string[];
  roles: string[];
  /** Permission resources */
  permissions: string[];
  filters: INotificationSubscriptionFilter[];
  /** Also notify the users the sending service names (Selected only) */
  alsoNamedUsers: boolean;
  /** Also notify the user who did the action, when a person did it (Selected only). Missing on older servers. */
  alsoDoneBy?: boolean;
}

/** Text lives in Localization (module `notifications`); the config only holds the keys. */
export interface INotificationPushTemplate {
  titleKey: string;
  bodyKey: string;
  link: string;
}

/** Delivery and receiver fields. Rows from older servers lack them: read the defaults in the form mapper. */
export interface INotificationConfigDeliveryFields {
  /** 0 Consumer users, 1 OS users, 2 Both */
  scope?: number;
  audience?: INotificationAudience | null;
  defaultAudience?: INotificationAudience | null;
  /** Personal notices: the audience and push text are fixed, only channels and on/off change. */
  audienceLocked?: boolean;
  liveEnabled?: boolean;
  pushEnabled?: boolean;
  pushTemplate?: INotificationPushTemplate | null;
  /** Push platforms the notification goes to; missing or empty means all three. */
  pushPlatforms?: PushPlatform[] | null;
  pushOptions?: IPushOptions | null;
  /** 0 means the server default (120 per minute). */
  rateLimitPerMinute?: number;
}

export interface INotificationConfigRow
  extends INotificationConfigBuiltInFields, INotificationConfigDeliveryFields {
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

export interface ISaveNotificationConfigPayload
  extends INotificationConfigBuiltInFields, INotificationConfigDeliveryFields {
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
