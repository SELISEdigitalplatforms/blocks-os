import { lazyOption, textMap, tn } from "../i18n";

const KEY_PUSH = "NOTIFICATION_UI.PUSH";
const KEY_RECIPIENTS = "NOTIFICATION_UI.RECIPIENTS";

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

export const SEND_TO_LABELS = textMap({
  [NOTIFICATION_SCOPE.Project]: "NOTIFICATION_UI.CONSUMER_USERS",
  [NOTIFICATION_SCOPE.Console]: "NOTIFICATION_UI.OS_USERS",
  [NOTIFICATION_SCOPE.Both]: "NOTIFICATION_UI.SEND_TO_BOTH",
}) as Record<number, string>;

/**
 * Two choices on screen. "Targeted" is the Selected level; the event owner tick is its alsoNamedUsers
 * flag, and "event owner only" is still saved as the AffectedOnly level, so stored data keeps its meaning.
 */
export const RECEIVER_OPTIONS = [
  lazyOption(AUDIENCE_LEVEL.AllUsers, "NOTIFICATION_UI.ALL_USERS"),
  lazyOption(AUDIENCE_LEVEL.Selected, "NOTIFICATION_UI.TARGETED"),
] as const;

export const RECEIVER_HELP = textMap({
  [AUDIENCE_LEVEL.AllUsers]: "NOTIFICATION_UI.RECEIVER_ALL_HELP",
  [AUDIENCE_LEVEL.Selected]: "NOTIFICATION_UI.RECEIVER_TARGETED_HELP",
}) as Record<number, string>;

export const MATCH_OPTIONS = [
  {
    value: AUDIENCE_MATCH.Any,
    get label() {
      return tn("NOTIFICATION_UI.MATCH_ANY");
    },
    get help() {
      return tn("NOTIFICATION_UI.MATCH_ANY_HELP");
    },
  },
  {
    value: AUDIENCE_MATCH.All,
    get label() {
      return tn("NOTIFICATION_UI.MATCH_ALL");
    },
    get help() {
      return tn("NOTIFICATION_UI.MATCH_ALL_HELP");
    },
  },
] as const;

export const ownerOnlyLabel = (): string => tn("NOTIFICATION_UI.OWNER_ONLY");

export const NOTIFICATION_TEXT = textMap({
  mobilePush: KEY_PUSH,
  searchPlaceholder: "NOTIFICATION_UI.SEARCH_PLACEHOLDER",
  columns: {
    name: "common:NAME",
    recipients: KEY_RECIPIENTS,
    service: "NOTIFICATION_UI.COLUMN_SERVICE",
    importance: "NOTIFICATION_UI.IMPORTANCE",
    inApp: "NOTIFICATION_UI.COLUMN_IN_APP",
    push: KEY_PUSH,
    inbox: "NOTIFICATION_UI.OFFLINE",
    delivery: "NOTIFICATION_UI.DELIVERY_CHANNELS",
    status: "common:STATUS",
  },
  /** Help for the merged Recipients column: the audience group and who in it gets the notice. */
  recipientsHelp: [
    "NOTIFICATION_UI.RECIPIENTS_HELP_AUDIENCE",
    "NOTIFICATION_UI.RECIPIENTS_HELP_ALL_USERS",
    "NOTIFICATION_UI.RECIPIENTS_HELP_TARGETED",
    "NOTIFICATION_UI.RECIPIENTS_HELP_OWNER",
    "NOTIFICATION_UI.RECIPIENTS_HELP_DONE_BY",
    "NOTIFICATION_UI.RECIPIENTS_HELP_ACCOUNT_OWNER",
  ],
  recipientsHelpLabel: "NOTIFICATION_UI.RECIPIENTS_HELP_LABEL",
  noMatches: "NOTIFICATION_UI.NO_MATCHES",
  active: "NOTIFICATION_UI.ACTIVE",
  inactive: "NOTIFICATION_UI.INACTIVE",
  filters: {
    sendTo: "NOTIFICATION_UI.AUDIENCE",
    receivers: KEY_RECIPIENTS,
  },
  custom: "NOTIFICATION_UI.CUSTOM",
  builtIn: "NOTIFICATION_UI.BUILT_IN",
  customSubtitle: "NOTIFICATION_UI.CUSTOM_SUBTITLE",
  noBuiltInSubtitle: "NOTIFICATION_UI.BUILT_IN_SUBTITLE",
  eventLabel: "NOTIFICATION_UI.EVENT",
  eventName: "NOTIFICATION_UI.EVENT_NAME",
  enabled: "common:ENABLED",
  description: "common:DESCRIPTION",
  sendToLabel: "NOTIFICATION_UI.AUDIENCE",
  projectUsers: "NOTIFICATION_UI.CONSUMER_USERS",
  consoleUsers: "NOTIFICATION_UI.OS_USERS",
  sendToHelp: "NOTIFICATION_UI.SEND_TO_HELP",
  personalHelp: "NOTIFICATION_UI.PERSONAL_HELP",
  receiversLabel: KEY_RECIPIENTS,
  receiversNarrowHelp: "NOTIFICATION_UI.RECEIVERS_NARROW_HELP",
  match: "NOTIFICATION_UI.MATCH",
  matchHelp: "NOTIFICATION_UI.MATCH_HELP",
  users: "NOTIFICATION_UI.USERS",
  roles: "NOTIFICATION_UI.ROLES",
  permissions: "NOTIFICATION_UI.PERMISSIONS",
  searchUsers: "NOTIFICATION_UI.SEARCH_USERS",
  searchRoles: "NOTIFICATION_UI.SEARCH_ROLES",
  searchPermissions: "NOTIFICATION_UI.SEARCH_PERMISSIONS",
  noOptionMatches: "NOTIFICATION_UI.NO_OPTION_MATCHES",
  loading: "common:LOADING",
  alsoNamed: "NOTIFICATION_UI.ALSO_NAMED",
  alsoNamedHelp: "NOTIFICATION_UI.ALSO_NAMED_HELP",
  alsoDoneBy: "NOTIFICATION_UI.ALSO_DONE_BY",
  alsoDoneByHelp: "NOTIFICATION_UI.ALSO_DONE_BY_HELP",
  doneByShort: "NOTIFICATION_UI.DONE_BY_SHORT",
  targeted: "NOTIFICATION_UI.TARGETED",
  eventOwner: "NOTIFICATION_UI.EVENT_OWNER",
  allUsersBuiltInWarning: "NOTIFICATION_UI.ALL_USERS_BUILT_IN_WARNING",
  filterSummary: "NOTIFICATION_UI.FILTER_SUMMARY",
  filterContext: "NOTIFICATION_UI.FILTER_CONTEXT",
  filterAction: "NOTIFICATION_UI.FILTER_ACTION",
  filterValue: "NOTIFICATION_UI.FILTER_VALUE",
  addFilter: "NOTIFICATION_UI.ADD_FILTER",
  removeFilter: "common:REMOVE",
  filterHelp: "NOTIFICATION_UI.FILTER_HELP",
  channels: "NOTIFICATION_UI.DELIVERY_CHANNELS",
  inApp: "NOTIFICATION_UI.COLUMN_IN_APP",
  mobilePushChannel: KEY_PUSH,
  saveToInbox: "NOTIFICATION_UI.OFFLINE",
  saveToInboxHelp: "NOTIFICATION_UI.SAVE_TO_INBOX_HELP",
  rateLimit: "NOTIFICATION_UI.RATE_LIMIT",
  rateLimitAria: "NOTIFICATION_UI.RATE_LIMIT_ARIA",
  perMinute: "NOTIFICATION_UI.PER_MINUTE",
  pushNotReady: "NOTIFICATION_UI.PUSH_NOT_READY",
  setUpPush: "NOTIFICATION_UI.SET_UP_PUSH",
  pushMessage: "NOTIFICATION_UI.PUSH_MESSAGE",
  titleKey: "NOTIFICATION_UI.TITLE_KEY",
  messageKey: "NOTIFICATION_UI.MESSAGE_KEY",
  titleKeyPlaceholder: "NOTIFICATION_UI.TITLE_KEY_PLACEHOLDER",
  messageKeyPlaceholder: "NOTIFICATION_UI.MESSAGE_KEY_PLACEHOLDER",
  optional: "NOTIFICATION_UI.OPTIONAL",
  localizationHelp: "NOTIFICATION_UI.LOCALIZATION_HELP",
  manageKeys: "NOTIFICATION_UI.MANAGE_KEYS",
  previewIn: "NOTIFICATION_UI.PREVIEW_IN",
  previewLanguage: "NOTIFICATION_UI.PREVIEW_LANGUAGE",
  keysLoadFailed: "NOTIFICATION_UI.KEYS_LOAD_FAILED",
  fixedText: "NOTIFICATION_UI.FIXED_TEXT",
  developerNotes: "NOTIFICATION_UI.DEVELOPER_NOTES",
  importance: "NOTIFICATION_UI.IMPORTANCE",
  kind: "NOTIFICATION_UI.KIND",
  sourceService: "NOTIFICATION_UI.SOURCE_SERVICE",
  recommendation: "NOTIFICATION_UI.RECOMMENDATION",
  appNote: "NOTIFICATION_UI.APP_NOTE",
  builtInAllProjects: "NOTIFICATION_UI.BUILT_IN_ALL_PROJECTS",
  developerNotesHelp: "NOTIFICATION_UI.DEVELOPER_NOTES_HELP",
  developerNotesReadOnly: "NOTIFICATION_UI.DEVELOPER_NOTES_READ_ONLY",
  cancel: "common:CANCEL",
  save: "common:SAVE",
  saving: "NOTIFICATION_UI.SAVING",
  breadcrumb: "NOTIFICATION_UI.BREADCRUMB",
  newBreadcrumb: "NOTIFICATION_UI.NEW_BREADCRUMB",
  errors: {
    name: () => tn("NOTIFICATION_UI.ERROR_NAME", { min: LIMITS.nameMin, max: LIMITS.nameMax }),
    sendTo: "NOTIFICATION_UI.ERROR_SEND_TO",
    channel: "NOTIFICATION_UI.ERROR_CHANNEL",
    pushKeys: "NOTIFICATION_UI.ERROR_PUSH_KEYS",
    rate: () => tn("NOTIFICATION_UI.ERROR_RATE", { max: LIMITS.rateMax }),
    targeted: "NOTIFICATION_UI.ERROR_TARGETED",
    limits: "NOTIFICATION_UI.ERROR_LIMITS",
    filters: () => tn("NOTIFICATION_UI.ERROR_FILTERS", { max: LIMITS.filters }),
    link: () => tn("NOTIFICATION_UI.ERROR_LINK", { max: LIMITS.textLength }),
  },
  toastSaved: "NOTIFICATION_UI.TOAST_SAVED",
  toastCreated: "NOTIFICATION_UI.TOAST_CREATED",
  loadFailed: "NOTIFICATION_UI.LOAD_FAILED",
  notFound: "NOTIFICATION_UI.NOT_FOUND",
});

export const MISSING_LANGUAGE_NOTE = (languages: string[]) =>
  tn("NOTIFICATION_UI.MISSING_LANGUAGE_NOTE", { languages: languages.join(", ") });

/** Shape of a Firebase private key, shown as a hint; not translated. */
export const PRIVATE_KEY_PLACEHOLDER = "-----BEGIN PRIVATE KEY-----";

export const PUSH_TEXT = textMap({
  title: "PUSH_SETTINGS.TITLE",
  subtitle: "PUSH_SETTINGS.SUBTITLE",
  connection: "PUSH_SETTINGS.CONNECTION",
  status: "common:STATUS",
  ready: "PUSH_SETTINGS.READY",
  notSetUp: "PUSH_SETTINGS.NOT_SET_UP",
  firebaseProject: "PUSH_SETTINGS.FIREBASE_PROJECT",
  keyLabel: "PUSH_SETTINGS.KEY_LABEL",
  keyUploaded: "PUSH_SETTINGS.KEY_UPLOADED",
  upload: "PUSH_SETTINGS.UPLOAD",
  replace: "PUSH_SETTINGS.REPLACE",
  keyHelp: "PUSH_SETTINGS.KEY_HELP",
  invalidKey: "PUSH_SETTINGS.INVALID_KEY",
  fromKey: "PUSH_SETTINGS.FROM_KEY",
  fromEmail: "PUSH_SETTINGS.FROM_EMAIL",
  noProject: "PUSH_SETTINGS.NO_PROJECT",
  noProjectManual: "PUSH_SETTINGS.NO_PROJECT_MANUAL",
  keySource: "PUSH_SETTINGS.KEY_SOURCE",
  manualMode: "PUSH_SETTINGS.MANUAL_MODE",
  clientEmail: "PUSH_SETTINGS.CLIENT_EMAIL",
  clientEmailPlaceholder: "PUSH_SETTINGS.CLIENT_EMAIL_PLACEHOLDER",
  privateKey: "PUSH_SETTINGS.PRIVATE_KEY",
  manualHelp: "PUSH_SETTINGS.MANUAL_HELP",
  manualIncomplete: "PUSH_SETTINGS.MANUAL_INCOMPLETE",
  emailInvalid: "PUSH_SETTINGS.EMAIL_INVALID",
  emailChecked: "PUSH_SETTINGS.EMAIL_CHECKED",
  keyChecked: "PUSH_SETTINGS.KEY_CHECKED",
  contentHidden: "PUSH_SETTINGS.CONTENT_HIDDEN",
  otherProject: "PUSH_SETTINGS.OTHER_PROJECT",
  otherProjectWeb: "PUSH_SETTINGS.OTHER_PROJECT_WEB",
  pushOn: "PUSH_SETTINGS.PUSH_ON",
  saved: "PUSH_SETTINGS.SAVED",
  needKey: "PUSH_SETTINGS.NEED_KEY",
  howToFind: "PUSH_SETTINGS.HOW_TO_FIND",
});
