import { lazyOption, textMap, tn } from "../i18n";

const KEY_NONE = "NOTIFICATION_CONSTANT.NONE";

export const channelsToNotify = [
  { label: "SignalR", value: 0 },
  { label: "Firebase", value: 1 },
];

export const notificationTypes = [
  lazyOption(0, KEY_NONE),
  lazyOption(1, "NOTIFICATION_CONSTANT.TYPE_BROADCAST"),
  lazyOption(2, "NOTIFICATION_CONSTANT.TYPE_USERS"),
  lazyOption(3, "NOTIFICATION_CONSTANT.TYPE_FILTER"),
];

export const notificationImportances = [
  lazyOption(0, KEY_NONE),
  lazyOption(1, "NOTIFICATION_CONSTANT.IMPORTANCE_LOW"),
  lazyOption(2, "NOTIFICATION_CONSTANT.IMPORTANCE_MEDIUM"),
  lazyOption(3, "NOTIFICATION_CONSTANT.IMPORTANCE_HIGH"),
];

export const notificationKinds = [
  lazyOption(0, KEY_NONE),
  lazyOption(1, "NOTIFICATION_CONSTANT.KIND_JOB"),
  lazyOption(2, "NOTIFICATION_CONSTANT.KIND_PROGRESS"),
  lazyOption(3, "NOTIFICATION_CONSTANT.KIND_ALERT"),
  lazyOption(4, "NOTIFICATION_CONSTANT.KIND_SECURITY"),
  lazyOption(5, "NOTIFICATION_CONSTANT.KIND_ACCESS"),
];

export const NOTIFICATION_KIND_JOB = 1;
export const NOTIFICATION_KIND_PROGRESS = 2;

/** A built-in config of kind Job or Progress: a page waits for its result. It can still be turned off. */
export const isWaitedOnByPage = (config: { isBuiltIn?: boolean; kind?: number }): boolean =>
  !!config.isBuiltIn &&
  (config.kind === NOTIFICATION_KIND_JOB || config.kind === NOTIFICATION_KIND_PROGRESS);

export const waitedOnOffWarning = (): string => tn("NOTIFICATION_CONSTANT.WAITED_ON_OFF_WARNING");

/** Readable copy for the save and delete refusals of built-in configurations. The keys are the server's error codes. */
export const NOTIFICATION_CONFIG_ERROR_MESSAGES: Record<string, string> = textMap({
  Only_Root_Tenant_Can_Manage_Built_In_Notification_Configuration:
    "NOTIFICATION_CONSTANT.ERROR_ROOT_ONLY_BUILT_IN",
  Built_In_Notification_Configuration_Is_Read_Only:
    "NOTIFICATION_CONSTANT.ERROR_BUILT_IN_READ_ONLY",
  Only_Root_Tenant_Can_Set_Default_Audience: "NOTIFICATION_CONSTANT.ERROR_ROOT_ONLY_AUDIENCE",
  Notification_Audience_Is_Locked: "NOTIFICATION_CONSTANT.ERROR_AUDIENCE_LOCKED",
  Notification_Audience_Not_Allowed: "NOTIFICATION_CONSTANT.ERROR_AUDIENCE_NOT_ALLOWED",
  Notification_Grant_Scope_Unavailable: "NOTIFICATION_CONSTANT.ERROR_GRANT_SCOPE_UNAVAILABLE",
  Notification_Send_To_Invalid: "NOTIFICATION_CONSTANT.ERROR_SEND_TO_INVALID",
  Notification_Audience_Invalid: "NOTIFICATION_CONSTANT.ERROR_AUDIENCE_INVALID",
  Notification_Audience_List_Too_Long: "NOTIFICATION_CONSTANT.ERROR_LIST_TOO_LONG",
  Notification_Audience_Item_Too_Long: "NOTIFICATION_CONSTANT.ERROR_ITEM_TOO_LONG",
  Notification_Filter_Context_Required: "NOTIFICATION_CONSTANT.ERROR_FILTER_CONTEXT_REQUIRED",
  Notification_Channel_Required: "NOTIFICATION_CONSTANT.ERROR_CHANNEL_REQUIRED",
  Notification_Push_Keys_Required: "NOTIFICATION_CONSTANT.ERROR_PUSH_KEYS_REQUIRED",
  Notification_Rate_Limit_Out_Of_Range: "NOTIFICATION_CONSTANT.ERROR_RATE_LIMIT",
});

export const NOTIFICATION_PROPAGATION_NOT_QUEUED =
  "Notification_Configuration_Propagation_Not_Queued";
export const propagationWarningMessage = (): string =>
  tn("NOTIFICATION_CONSTANT.PROPAGATION_WARNING");
