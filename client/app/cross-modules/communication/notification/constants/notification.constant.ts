export const channelsToNotify = [
  { label: "SignalR", value: 0 },
  { label: "Firebase", value: 1 },
];

export const notificationTypes = [
  { label: "None", value: 0 },
  { label: "Broadcast", value: 1 },
  { label: "Users", value: 2 },
  { label: "Filter", value: 3 },
];

export const notificationImportances = [
  { label: "None", value: 0 },
  { label: "Low", value: 1 },
  { label: "Medium", value: 2 },
  { label: "High", value: 3 },
];

export const notificationKinds = [
  { label: "None", value: 0 },
  { label: "Job", value: 1 },
  { label: "Progress", value: 2 },
  { label: "Alert", value: 3 },
  { label: "Security", value: 4 },
  { label: "Access", value: 5 },
];

export const notificationScopes = [
  { label: "App (copied to every project)", value: 0 },
  { label: "Console (root tenant only)", value: 1 },
];

export const AUDIENCE_MODE_SENDER = "sender";
export const AUDIENCE_MODE_EVERYONE = "everyone";
export const AUDIENCE_MODE_RULES = "rules";

export const audienceMatches = [
  { label: "Any rule", value: 0 },
  { label: "All rules", value: 1 },
];

/** Same limits as the server validator. */
export const AUDIENCE_MAX_USERS = 500;
export const AUDIENCE_MAX_OTHER = 50;
export const AUDIENCE_MAX_FILTERS = 20;
export const AUDIENCE_MAX_TEXT = 200;

export const AUDIENCE_HINT = "Code that sends this notification can only narrow this list.";

export const NOTIFICATION_KIND_JOB = 1;
export const NOTIFICATION_KIND_PROGRESS = 2;

/** Mirrors the server rule: a built-in config of kind Job or Progress cannot be turned off. */
export const canNotificationConfigBeDisabled = (config: {
  isBuiltIn?: boolean;
  kind?: number;
}): boolean =>
  !config.isBuiltIn ||
  (config.kind !== NOTIFICATION_KIND_JOB && config.kind !== NOTIFICATION_KIND_PROGRESS);

export const ALWAYS_ON_MESSAGE = "Always on: a page waits for this result";

/** Readable copy for the save and delete refusals of built-in configurations. */
export const NOTIFICATION_CONFIG_ERROR_MESSAGES: Record<string, string> = {
  Only_Root_Tenant_Can_Manage_Built_In_Notification_Configuration:
    "Only a root-tenant administrator can add, change or delete built-in notification configurations.",
  Built_In_Notification_Configuration_Is_Read_Only:
    "This built-in configuration is read-only. You can only turn it on or off and change who receives it.",
  Notification_Configuration_Cannot_Be_Disabled:
    "This configuration cannot be turned off: a page waits for its result.",
};

export const NOTIFICATION_PROPAGATION_NOT_QUEUED =
  "Notification_Configuration_Propagation_Not_Queued";
export const PROPAGATION_WARNING_MESSAGE =
  "Saved, but not copied to tenants yet. Save again to retry.";
