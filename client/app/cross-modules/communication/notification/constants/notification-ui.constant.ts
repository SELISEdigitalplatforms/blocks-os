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
  [NOTIFICATION_SCOPE.Both]: "Project & Console users",
};

/**
 * Two choices on screen. "Targeted" is the Selected level; the event owner tick is its alsoNamedUsers
 * flag, and "event owner only" is still saved as the AffectedOnly level, so stored data keeps its meaning.
 */
export const RECEIVER_OPTIONS = [
  { value: AUDIENCE_LEVEL.AllUsers, label: "All users" },
  { value: AUDIENCE_LEVEL.Selected, label: "Targeted" },
] as const;

export const RECEIVER_HELP: Record<number, string> = {
  [AUDIENCE_LEVEL.AllUsers]: "Every user in the audience gets every event.",
  [AUDIENCE_LEVEL.Selected]: "Only the event owner and the users, roles and permissions you pick.",
};

export const MATCH_OPTIONS = [
  { value: AUDIENCE_MATCH.Any, label: "Any of these" },
  { value: AUDIENCE_MATCH.All, label: "All of these" },
] as const;

export const OWNER_ONLY_LABEL = "Account owner only";

export const NOTIFICATION_TEXT = {
  mobilePush: MOBILE_PUSH,
  searchPlaceholder: "Search by name",
  columns: {
    name: "Name",
    recipients: "Recipients",
    service: "Service",
    importance: "Importance",
    inApp: "In-app",
    push: MOBILE_PUSH,
    inbox: "Offline",
    delivery: "Delivery channels",
    status: "Status",
  },
  channelOn: "on",
  channelOff: "off",
  /** Help for the merged Recipients column: the audience group and who in it gets the notice. */
  recipientsHelp: [
    "Audience: Project users use your application; Console users work in Blocks Console.",
    "All users: everyone in the audience gets every event.",
    "Targeted: only the event owner and the users, roles and permissions picked.",
    "Event owner: the user the event is about, named by the sending service.",
    "Account owner only: a personal notice; it always goes to the account owner.",
  ],
  recipientsHelpLabel: "What recipients mean",
  noMatches: "No notifications match the current filters.",
  active: "Active",
  inactive: "Inactive",
  filters: {
    sendTo: "Audience",
    receivers: "Recipients",
  },
  custom: "Custom",
  builtIn: "Built-in",
  customSubtitle: "Custom notification",
  noBuiltInSubtitle: "Built-in notification",
  eventLabel: "Event",
  eventName: "Event name",
  enabled: "Enabled",
  description: "Description",
  sendToLabel: "Audience",
  projectUsers: "Project users",
  consoleUsers: "Console users",
  sendToHelp: "Project users use your application. Console users work in Blocks Console.",
  personalHelp:
    "Personal account notice. It is always sent to the account owner and cannot be redirected.",
  receiversLabel: "Recipients",
  receiversNarrowHelp: "The sending service can narrow this list, but never extend it.",
  match: "Match",
  users: "Users",
  roles: "Roles",
  permissions: "Permissions",
  searchUsers: "Search users",
  searchRoles: "Search roles",
  searchPermissions: "Search permissions",
  noOptionMatches: "No matches",
  loading: "Loading...",
  alsoNamed: "Event owner",
  alsoNamedHelp:
    "The user the event is about, such as the account owner or the person who started the job. The sending service names this user.",
  targeted: "Targeted",
  eventOwner: "event owner",
  picked: "picked",
  allUsersBuiltInWarning:
    "Every user will get this notice, also for events about other users. Use Targeted to keep it to the event owner.",
  filterSummary: "Subscription filter (optional)",
  filterContext: "Context",
  filterAction: "Action",
  filterValue: "Value",
  addFilter: "+ Add filter",
  removeFilter: "Remove",
  filterHelp: "Narrows receivers to users subscribed to a matching context. Never adds receivers.",
  channels: "Delivery channels",
  inApp: "In-app",
  mobilePushChannel: MOBILE_PUSH,
  saveToInbox: "Offline",
  saveToInboxHelp:
    "Offline keeps the notification, so users who are offline see it when they come back.",
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
  developerNotesReadOnly:
    "Built-in notes are shared by all projects. Only the root project can change them.",
  cancel: "Cancel",
  save: "Save",
  saving: "Saving...",
  breadcrumb: "Notification",
  newBreadcrumb: "New notification",
  errors: {
    name: `Event name must be between ${LIMITS.nameMin} and ${LIMITS.nameMax} characters.`,
    sendTo: "Select at least one group to send to.",
    channel: "Select at least one channel: in-app or mobile push.",
    pushKeys: "Choose a title key and a message key for the push message.",
    rate: `Rate limit must be a whole number from 0 to ${LIMITS.rateMax}.`,
    targeted: "Targeted needs the event owner or at least one user, role or permission.",
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
  status: "Status",
  ready: "Configured",
  notSetUp: "Not configured",
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
  fromKey: "(from key)",
  noProject: "Set by the key",
  keySource: "How to add the key",
  manualMode: "Enter manually",
  clientEmail: "Client email",
  clientEmailPlaceholder: "e.g. firebase-adminsdk@my-app-123.iam.gserviceaccount.com",
  privateKey: "Private key",
  privateKeyPlaceholder: "-----BEGIN PRIVATE KEY-----",
  manualHelp:
    "Copy project_id, client_email and private_key from the key file in the Firebase console.",
  manualIncomplete: "Fill in the project ID, client email and the full private key.",
  otherProject:
    "This key is for another Firebase project. Phones registered with the old project stop getting push.",
  pushOn: "Send mobile push",
  testTitle: "Test delivery",
  sendTest: "Send a test notification to my devices",
  testHelp: "Your signed-in devices receive a test message within a few seconds.",
  saved: "Mobile push settings saved.",
  keyStored: "Service account key stored",
  testSent: "Test notification sent",
  needKey: "Add a service account key to finish setup.",
} as const;
