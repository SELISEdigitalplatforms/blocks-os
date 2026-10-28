/** Numeric values the notification API uses for the receiver fields. */
export const NOTIFICATION_SCOPE = { Project: 0, Console: 1, Both: 2 } as const;
export const AUDIENCE_LEVEL = { AffectedOnly: 0, AllUsers: 1, Selected: 2 } as const;
export const AUDIENCE_MATCH = { Any: 0, All: 1 } as const;

export const LIMITS = {
  userIds: 500,
  roles: 50,
  permissions: 50,
  filters: 20,
  textLength: 200,
  rateMax: 600,
  rateDefault: 120,
  nameMin: 3,
  nameMax: 100,
} as const;

/** The Localization module that holds the push texts. */
export const NOTIFICATION_LOCALIZATION_MODULE = "notifications";

const MOBILE_PUSH = "Mobile push";

export const SEND_TO_LABELS: Record<number, string> = {
  [NOTIFICATION_SCOPE.Project]: "Project users",
  [NOTIFICATION_SCOPE.Console]: "Console users",
  [NOTIFICATION_SCOPE.Both]: "Project and Console users",
};

export const RECEIVER_OPTIONS = [
  { value: AUDIENCE_LEVEL.AllUsers, label: "All users" },
  { value: AUDIENCE_LEVEL.AffectedOnly, label: "Affected users only" },
  { value: AUDIENCE_LEVEL.Selected, label: "Selected" },
] as const;

export const RECEIVER_HELP: Record<number, string> = {
  [AUDIENCE_LEVEL.AllUsers]: "Every user who can receive this notification.",
  [AUDIENCE_LEVEL.AffectedOnly]:
    "Only the users the sending service names, such as the record owner.",
  [AUDIENCE_LEVEL.Selected]: "Only the users, roles and permissions selected below.",
};

export const MATCH_OPTIONS = [
  { value: AUDIENCE_MATCH.Any, label: "Any of these" },
  { value: AUDIENCE_MATCH.All, label: "All of these" },
] as const;

export const OWNER_ONLY_LABEL = "Account owner only \u{1F512}";

export const NOTIFICATION_TEXT = {
  listTitle: "Notifications",
  listSubtitle: "Choose who receives each notification and how it is delivered.",
  newNotification: "New notification",
  mobilePush: MOBILE_PUSH,
  searchPlaceholder: "Search notifications",
  columns: {
    name: "Name",
    sendTo: "Send to",
    receivers: "Receivers",
    inApp: "In-app",
    push: "Push",
    inbox: "Inbox",
    status: "Status",
  },
  filters: {
    sendTo: "Send to",
    receivers: "Receivers",
  },
  custom: "Custom",
  builtIn: "Built-in",
  customSubtitle: "Custom notification",
  noBuiltInSubtitle: "Built-in notification",
  eventLabel: "Event",
  eventName: "Event name",
  enabled: "Enabled",
  description: "Description",
  sendToLabel: "Send to",
  projectUsers: "Project users",
  consoleUsers: "Console users",
  sendToHelp: "Project users use your application. Console users work in Blocks Console.",
  personalHelp:
    "Personal account notice. It is always sent to the account owner and cannot be redirected.",
  receiversLabel: "Receivers",
  receiversNarrowHelp: "The sending service can narrow this list, but never extend it.",
  match: "Match",
  users: "Users",
  roles: "Roles",
  permissions: "Permissions",
  searchUsers: "Search users",
  searchRoles: "Search roles",
  searchPermissions: "Search permissions",
  noMatches: "No matches",
  loading: "Loading...",
  alsoNamed: "Also notify the users named by the sending service",
  filterSummary: "Subscription filter (optional)",
  filterContext: "Context",
  filterAction: "Action",
  filterValue: "Value",
  addFilter: "+ Add filter",
  removeFilter: "Remove",
  filterHelp: "Narrows receivers to users subscribed to a matching context. Never adds receivers.",
  channels: "Channels",
  inApp: "In-app",
  mobilePushChannel: MOBILE_PUSH,
  saveToInbox: "Save to inbox",
  rateLimit: "Rate limit",
  rateLimitAria: "Rate limit per minute",
  perMinute: "/ min",
  pushNotReady: "Mobile push is not set up for this project yet.",
  setUpPush: "Set up mobile push",
  pushMessage: "Push message",
  titleKey: "Title key",
  messageKey: "Message key",
  openLink: "Open link",
  openLinkAria: "Open link (optional)",
  optional: "Optional",
  localizationHelp:
    "Text and translations come from Localization (module notifications). Each user gets their own language; a missing language falls back to the default language.",
  manageKeys: "Manage keys in Localization ↗",
  previewIn: "Preview in",
  previewLanguage: "Preview language",
  selectKey: "Select a key",
  keysLoadFailed: "The Localization keys could not be loaded.",
  fixedText: "Fixed text. Personal notices never show account details on the lock screen.",
  developerNotes: "Developer notes",
  importance: "Importance",
  kind: "Kind",
  sourceService: "Source service",
  recommendation: "Recommendation for apps",
  appNote: "Note for apps without the portal",
  builtInAllProjects: "Built-in (all projects)",
  developerNotesHelp: "Recommendation and integration notes for application developers.",
  cancel: "Cancel",
  save: "Save",
  saving: "Saving...",
  breadcrumb: "Notifications",
  newBreadcrumb: "New notification",
  errors: {
    name: `Event name must be between ${LIMITS.nameMin} and ${LIMITS.nameMax} characters.`,
    sendTo: "Select at least one group to send to.",
    channel: "Select at least one channel: in-app or mobile push.",
    pushKeys: "Choose a title key and a message key for the push message.",
    rate: `Rate limit must be a whole number from 0 to ${LIMITS.rateMax}.`,
    limits: "A list has too many entries.",
    filters: `Use at most ${LIMITS.filters} subscription filters; each needs a context.`,
    link: `The link must be at most ${LIMITS.textLength} characters.`,
  },
  toastSaved: "Configuration updated successfully.",
  toastCreated: "New configuration added successfully.",
  loadFailed: "The notification could not be loaded.",
  notFound: "This notification was not found.",
} as const;

export const MISSING_LANGUAGE_NOTE = (languages: string[]) =>
  `No ${languages.join(", ")} text yet — the default language is used.`;

export const PUSH_TEXT = {
  title: MOBILE_PUSH,
  subtitle: "Send notifications to your users' phones through Firebase Cloud Messaging.",
  breadcrumb: "Notifications / Mobile push",
  status: "Status",
  ready: "Ready",
  notSetUp: "Not set up",
  firebaseProject: "Firebase project",
  projectId: "Project ID",
  projectIdPlaceholder: "e.g. my-app-123",
  keyLabel: "Service account key",
  keyUploaded: "Key uploaded",
  upload: "Upload JSON file",
  replace: "Replace",
  keyHelp: "Stored securely in the secret store. It is never displayed again.",
  chosenFile: "Selected file:",
  invalidKey: "This file is not a Firebase service account key.",
  enable: "Enable mobile push for this project",
  testTitle: "Test",
  sendTest: "Send a test notification to my devices",
  testHelp: "Your signed-in devices receive a test message within a few seconds.",
  saved: "Mobile push settings saved.",
  keyStored: "Service account key stored",
  testSent: "Test notification sent",
  needKey: "Upload a service account key to finish setup",
} as const;
