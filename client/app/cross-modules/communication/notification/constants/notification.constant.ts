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

export const NOTIFICATION_KIND_JOB = 1;
export const NOTIFICATION_KIND_PROGRESS = 2;

/** A built-in config of kind Job or Progress: a page waits for its result. It can still be turned off. */
export const isWaitedOnByPage = (config: { isBuiltIn?: boolean; kind?: number }): boolean =>
  !!config.isBuiltIn &&
  (config.kind === NOTIFICATION_KIND_JOB || config.kind === NOTIFICATION_KIND_PROGRESS);

export const WAITED_ON_OFF_WARNING =
  "A page waits for this event. While it is off, that page gets no updates.";

/** Readable copy for the save and delete refusals of built-in configurations. */
export const NOTIFICATION_CONFIG_ERROR_MESSAGES: Record<string, string> = {
  Only_Root_Tenant_Can_Manage_Built_In_Notification_Configuration:
    "Only a root-tenant administrator can add, change or delete built-in notification configurations.",
  Built_In_Notification_Configuration_Is_Read_Only:
    "This built-in configuration is read-only. You can only turn it on or off.",
  Only_Root_Tenant_Can_Set_Default_Audience:
    "Only a root-tenant administrator can set the default receivers or lock them.",
  Notification_Audience_Is_Locked:
    "This is a personal notice. Its receivers and push message are fixed; you can only turn it on or off and change its channels.",
  Notification_Audience_Not_Allowed:
    "You can only pick roles and permissions that you hold or manage.",
  Notification_Grant_Scope_Unavailable:
    "Your access could not be checked right now, so no new roles or permissions can be added. Try again in a moment.",
  Notification_Send_To_Invalid: "Select who the notification is sent to.",
  Notification_Audience_Invalid: "The receivers are not valid.",
  Notification_Audience_List_Too_Long:
    "A receivers list has too many entries (users 500, roles 50, permissions 50, filters 20).",
  Notification_Audience_Item_Too_Long: "An entry is longer than 200 characters.",
  Notification_Filter_Context_Required: "Each subscription filter needs a context.",
  Notification_Channel_Required: "Select at least one channel: in-app or push.",
  Notification_Push_Keys_Required: "Choose a title key and a message key for the push message.",
  Notification_Rate_Limit_Out_Of_Range: "Rate limit must be a whole number from 0 to 600.",
};

export const NOTIFICATION_PROPAGATION_NOT_QUEUED =
  "Notification_Configuration_Propagation_Not_Queued";
export const PROPAGATION_WARNING_MESSAGE =
  "Saved, but not copied to tenants yet. Save again to retry.";
