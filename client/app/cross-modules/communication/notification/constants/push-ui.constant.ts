import type { PushPlatform, PushResultCode } from "../models/push.model";
import { lazyOption, textMap } from "../i18n";

/** Platform names are product names and stay as they are. */
export const PLATFORM_LABEL: Record<PushPlatform, string> = {
  android: "Android",
  ios: "iOS",
  web: "Web",
};

export const PUSH_RESULT_LABEL: Record<PushResultCode, string> = textMap({
  delivered: "PUSH_UI.RESULT_DELIVERED",
  apnsKeyMissing: "PUSH_UI.RESULT_APNS_KEY_MISSING",
  apnsKeyRejected: "PUSH_UI.RESULT_APNS_KEY_REJECTED",
  wrongApp: "PUSH_UI.RESULT_WRONG_APP",
  tokenExpired: "PUSH_UI.RESULT_TOKEN_EXPIRED",
  keyRefused: "PUSH_UI.RESULT_KEY_REFUSED",
  failed: "PUSH_UI.RESULT_FAILED",
});

/** One plain "what to do" line per result code (screen 2). */
export const PUSH_RESULT_FIX: Partial<Record<PushResultCode, string>> = textMap({
  apnsKeyMissing: "PUSH_UI.FIX_APNS_KEY_MISSING",
  apnsKeyRejected: "PUSH_UI.FIX_APNS_KEY_REJECTED",
  wrongApp: "PUSH_UI.FIX_WRONG_APP",
  tokenExpired: "PUSH_UI.FIX_TOKEN_EXPIRED",
  keyRefused: "PUSH_UI.FIX_KEY_REFUSED",
  failed: "PUSH_UI.FIX_FAILED",
});

export const APNS_HINT: Partial<Record<PushResultCode, string>> = textMap({
  apnsKeyMissing: "PUSH_UI.HINT_APNS_KEY_MISSING",
  apnsKeyRejected: "PUSH_UI.HINT_APNS_KEY_REJECTED",
});

export const PLATFORMS_TEXT = textMap({
  title: "PUSH_UI.PLATFORMS_TITLE",
  help: "PUSH_UI.PLATFORMS_HELP",
  platform: "PUSH_UI.PLATFORM",
  sending: "PUSH_UI.SENDING",
  devices: "PUSH_UI.DEVICES",
  lastTest: "PUSH_UI.LAST_TEST",
  sendTest: "PUSH_UI.SEND_TEST",
  testAll: "PUSH_UI.TEST_ALL",
  viewDevices: "PUSH_UI.VIEW_DEVICES",
  needsWebConfig: "PUSH_UI.NEEDS_WEB_CONFIG",
  notTested: "PUSH_UI.NOT_TESTED",
});

export const WEB_TEXT = textMap({
  title: "PUSH_UI.WEB_TITLE",
  notStored: "PUSH_UI.WEB_NOT_STORED",
  stored: "PUSH_UI.WEB_STORED",
  source: "PUSH_UI.WEB_SOURCE",
  upload: "PUSH_UI.WEB_UPLOAD",
  fields: "PUSH_UI.WEB_FIELDS",
  chooseFile: "PUSH_UI.WEB_CHOOSE_FILE",
  pasteLabel: "PUSH_UI.WEB_PASTE_LABEL",
  pastePlaceholder: "PUSH_UI.WEB_PASTE_PLACEHOLDER",
  added: "PUSH_UI.WEB_ADDED",
  remove: "common:REMOVE",
  apiKey: "PUSH_UI.WEB_API_KEY",
  appId: "PUSH_UI.WEB_APP_ID",
  senderId: "PUSH_UI.WEB_SENDER_ID",
  vapid: "PUSH_UI.WEB_VAPID",
  vapidPaste: "PUSH_UI.WEB_VAPID_PASTE",
  help: "PUSH_UI.WEB_HELP",
  foundFields: "PUSH_UI.WEB_FOUND_FIELDS",
  sameProject: "PUSH_UI.WEB_SAME_PROJECT",
  vapidEntered: "PUSH_UI.WEB_VAPID_ENTERED",
  ignored: "PUSH_UI.WEB_IGNORED",
  allFilled: "PUSH_UI.WEB_ALL_FILLED",
  saved: "PUSH_UI.WEB_SAVED",
});

export const WEB_PROBLEM_TEXT = textMap({
  notConfig: "PUSH_UI.PROBLEM_NOT_CONFIG",
  needConfig: "PUSH_UI.PROBLEM_NEED_CONFIG",
  otherProject: "PUSH_UI.PROBLEM_OTHER_PROJECT",
  needVapid: "PUSH_UI.PROBLEM_NEED_VAPID",
  needKey: "PUSH_UI.PROBLEM_NEED_KEY",
  fillAll: "PUSH_UI.PROBLEM_FILL_ALL",
  appIdFormat: "PUSH_UI.PROBLEM_APP_ID_FORMAT",
  valueFormat: "PUSH_UI.PROBLEM_VALUE_FORMAT",
  otherSender: "PUSH_UI.PROBLEM_OTHER_SENDER",
});

export const TEST_DIALOG_TEXT = textMap({
  title: "PUSH_UI.TEST_TITLE",
  close: "common:CLOSE",
  sendAgain: "PUSH_UI.TEST_SEND_AGAIN",
  noName: "PUSH_UI.TEST_NO_NAME",
});

export const DEVICES_TEXT = textMap({
  title: "PUSH_UI.DEVICES_TITLE",
  back: "PUSH_UI.DEVICES_BACK",
  subtitle: "PUSH_UI.DEVICES_SUBTITLE",
  filter: "PUSH_UI.DEVICES_FILTER",
  all: "common:ALL",
  search: "PUSH_UI.DEVICES_SEARCH",
  user: "PUSH_UI.DEVICES_USER",
  platform: "PUSH_UI.PLATFORM",
  device: "PUSH_UI.DEVICES_DEVICE",
  lastSeen: "PUSH_UI.DEVICES_LAST_SEEN",
  remove: "common:REMOVE",
  note: "PUSH_UI.DEVICES_NOTE",
  empty: "PUSH_UI.DEVICES_EMPTY",
  loadFailed: "PUSH_UI.DEVICES_LOAD_FAILED",
  confirmTitle: "PUSH_UI.DEVICES_CONFIRM_TITLE",
  confirmBody: "PUSH_UI.DEVICES_CONFIRM_BODY",
  confirmYes: "common:REMOVE",
  removed: "PUSH_UI.DEVICES_REMOVED",
  previous: "common:PREVIOUS",
  next: "common:NEXT",
});

export const PUSH_FORM_TEXT = textMap({
  platforms: "PUSH_UI.FORM_PLATFORMS",
  platformsHelp: "PUSH_UI.FORM_PLATFORMS_HELP",
  atLeastOne: "PUSH_UI.FORM_AT_LEAST_ONE",
  appLink: "PUSH_UI.FORM_APP_LINK",
  webLink: "PUSH_UI.FORM_WEB_LINK",
  webLinkError: "PUSH_UI.FORM_WEB_LINK_ERROR",
  options: "PUSH_UI.FORM_OPTIONS",
  optionsHelp: "PUSH_UI.FORM_OPTIONS_HELP",
  optionsAria: "PUSH_UI.PLATFORM",
  previewTitle: "PUSH_UI.FORM_PREVIEW_TITLE",
  previewHelp: "PUSH_UI.FORM_PREVIEW_HELP",
  sendTest: "PUSH_UI.FORM_SEND_TEST",
  needKeys: "PUSH_UI.FORM_NEED_KEYS",
  default: "PUSH_UI.FORM_DEFAULT",
  textError: "PUSH_UI.FORM_TEXT_ERROR",
  colorError: "PUSH_UI.FORM_COLOR_ERROR",
  badgeError: "PUSH_UI.FORM_BADGE_ERROR",
  iconError: "PUSH_UI.FORM_ICON_ERROR",
});

export const ANDROID_FIELDS = textMap({
  priority: "PUSH_UI.FIELD_PRIORITY",
  channel: "PUSH_UI.FIELD_CHANNEL",
  sound: "PUSH_UI.FIELD_SOUND",
  expires: "PUSH_UI.FIELD_EXPIRES",
  collapseKey: "PUSH_UI.FIELD_COLLAPSE_KEY",
  color: "PUSH_UI.FIELD_COLOR",
});

export const IOS_FIELDS = textMap({
  sound: "PUSH_UI.FIELD_SOUND",
  badge: "PUSH_UI.FIELD_BADGE",
  priority: "PUSH_UI.FIELD_PRIORITY",
  interruption: "PUSH_UI.FIELD_INTERRUPTION",
  thread: "PUSH_UI.FIELD_THREAD",
  expires: "PUSH_UI.FIELD_EXPIRES",
});

export const WEB_FIELDS = textMap({
  icon: "PUSH_UI.FIELD_ICON",
  requireInteraction: "PUSH_UI.FIELD_REQUIRE_INTERACTION",
  urgency: "PUSH_UI.FIELD_URGENCY",
  expires: "PUSH_UI.FIELD_EXPIRES",
});

export interface IOption {
  value: string;
  label: string;
}

/** Empty value = server default. Radix Select cannot hold "", so DEFAULT_VALUE stands for it. */
export const DEFAULT_VALUE = "__default";

export const PRIORITY_OPTIONS: IOption[] = [
  lazyOption("high", "PUSH_UI.OPTION_PRIORITY_HIGH"),
  lazyOption("normal", "PUSH_UI.OPTION_NORMAL"),
];

export const INTERRUPTION_OPTIONS: IOption[] = [
  lazyOption("active", "PUSH_UI.OPTION_ACTIVE"),
  lazyOption("time-sensitive", "PUSH_UI.OPTION_TIME_SENSITIVE"),
  lazyOption("passive", "PUSH_UI.OPTION_PASSIVE"),
];

export const URGENCY_OPTIONS: IOption[] = [
  lazyOption("very-low", "PUSH_UI.OPTION_VERY_LOW"),
  lazyOption("low", "PUSH_UI.OPTION_LOW"),
  lazyOption("normal", "PUSH_UI.OPTION_NORMAL"),
  lazyOption("high", "PUSH_UI.OPTION_HIGH"),
];

export const EXPIRY_OPTIONS: IOption[] = [
  lazyOption("3600", "PUSH_UI.OPTION_1_HOUR"),
  lazyOption("86400", "PUSH_UI.OPTION_1_DAY"),
  lazyOption("604800", "PUSH_UI.OPTION_1_WEEK"),
  lazyOption("2419200", "PUSH_UI.OPTION_4_WEEKS"),
];

export const MAX_TTL_SECONDS = 2_419_200;
