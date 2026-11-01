export const PUSH_PLATFORMS = ["android", "ios", "web"] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];
export type PlatformFlags = Record<PushPlatform, boolean>;

/** Answer of GET /api/PushSettings/Get. A key or web value is never part of it. */
export interface IPushSettings {
  projectId: string | null;
  enabled: boolean;
  /** True once a service account key is stored. */
  hasKey: boolean;
  keyUploadedAt?: string | null;
  keyUploadedBy?: string | null;
  platforms: PlatformFlags;
  hasWebConfig: boolean;
  webConfigUploadedAt?: string | null;
  webConfigUploadedBy?: string | null;
}

export interface IWebConfigPayload {
  apiKey: string;
  appId: string;
  messagingSenderId: string;
  vapidKey: string;
  projectId?: string;
}

/** Body of POST /api/PushSettings/Save. Key and web config are sent only when the user gave a new one. */
export interface ISavePushSettingsPayload {
  enabled: boolean;
  platforms: PlatformFlags;
  serviceAccountJson?: string;
  webConfig?: IWebConfigPayload;
}

export interface IPushSettingsAck {
  isSuccess?: boolean;
  errors?: Record<string, string> | null;
}

/** Result codes of one test send, per device. */
export type PushResultCode =
  | "delivered"
  | "apnsKeyMissing"
  | "apnsKeyRejected"
  | "wrongApp"
  | "tokenExpired"
  | "keyRefused"
  | "failed";

export interface IPushLastTest {
  at: string;
  delivered: number;
  failed: number;
  reason?: PushResultCode | null;
}

export interface IPushPlatformStatus {
  devices: number;
  lastTest: IPushLastTest | null;
}

export type IPushStatus = Record<PushPlatform, IPushPlatformStatus>;

export interface IPushTestDevice {
  platform: PushPlatform;
  name?: string | null;
  lastSeenAt?: string | null;
  result: PushResultCode;
  removed?: boolean;
}

export interface IPushTestResult {
  isSuccess?: boolean;
  errors?: Record<string, string> | null;
  sentAt: string;
  delivered: number;
  failed: number;
  devices: IPushTestDevice[];
}

export interface IPushTestRequest {
  platform?: PushPlatform;
}

export interface IPushDevice {
  id: string;
  userId: string;
  userName?: string | null;
  platform: PushPlatform;
  name?: string | null;
  lastSeenAt?: string | null;
}

export interface IPushDeviceCounts {
  all: number;
  android: number;
  ios: number;
  web: number;
}

export interface IPushDevicesPage {
  items: IPushDevice[];
  totalCount: number;
  counts: IPushDeviceCounts;
}

export interface IPushDevicesQuery {
  platform?: PushPlatform;
  search?: string;
  page: number;
  pageSize: number;
}

/** Options per platform, as stored (contract section 2). Empty values are left out. */
export interface IAndroidPushOptions {
  priority?: "high" | "normal" | null;
  channelId?: string | null;
  sound?: string | null;
  ttlSeconds?: number | null;
  collapseKey?: string | null;
  color?: string | null;
}

export interface IIosPushOptions {
  sound?: string | null;
  badge?: number | null;
  priority?: "high" | "normal" | null;
  interruptionLevel?: "active" | "time-sensitive" | "passive" | null;
  threadId?: string | null;
  ttlSeconds?: number | null;
}

export interface IWebPushOptions {
  icon?: string | null;
  requireInteraction?: boolean | null;
  urgency?: "very-low" | "low" | "normal" | "high" | null;
  ttlSeconds?: number | null;
}

export interface IPushOptions {
  webLink?: string | null;
  android?: IAndroidPushOptions | null;
  ios?: IIosPushOptions | null;
  web?: IWebPushOptions | null;
}

/** Body of POST Notifier/push-test/notification: the unsaved draft of the notification form. */
export interface IPushNotificationTestRequest {
  titleKey: string;
  bodyKey: string;
  link?: string;
  webLink?: string;
  platforms?: PushPlatform[];
  options?: Pick<IPushOptions, "android" | "ios" | "web">;
}
