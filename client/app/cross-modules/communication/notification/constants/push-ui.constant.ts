import type { PushPlatform, PushResultCode } from "../models/push.model";

export const PLATFORM_LABEL: Record<PushPlatform, string> = {
  android: "Android",
  ios: "iOS",
  web: "Web",
};

export const PUSH_RESULT_LABEL: Record<PushResultCode, string> = {
  delivered: "Delivered",
  apnsKeyMissing: "APNs key missing",
  apnsKeyRejected: "APNs key rejected",
  wrongApp: "Wrong app (bundle ID)",
  tokenExpired: "Token expired",
  keyRefused: "Key refused",
  failed: "Failed",
};

/** One plain "what to do" line per result code (screen 2). */
export const PUSH_RESULT_FIX: Partial<Record<PushResultCode, string>> = {
  apnsKeyMissing: "Fix: upload the APNs key in Firebase console → Cloud Messaging.",
  apnsKeyRejected:
    "Fix: check the Key ID and Team ID in Firebase. If the key was revoked in Apple, make a new key and upload it again.",
  wrongApp: "Fix: the iOS app in Firebase must have the same Bundle ID as the installed app.",
  tokenExpired: "The app was removed. This device was taken off the list.",
  keyRefused:
    "Fix: check the service account key and that Firebase Cloud Messaging API (V1) is enabled.",
  failed: "Send again. If it keeps failing, send a test to an Android device and compare.",
};

export const APNS_HINT: Partial<Record<PushResultCode, string>> = {
  apnsKeyMissing:
    "Upload your APNs key in Firebase console → Project settings → Cloud Messaging → Apple app configuration. Then send a test again.",
  apnsKeyRejected:
    "Key ID or Team ID is wrong, or the key was revoked in Apple. Check both IDs; if revoked, make a new key and upload it again.",
};

export const PLATFORMS_TEXT = {
  title: "Platforms",
  help: "Turn a platform off to stop sending to its devices. Test sends only to your own devices.",
  platform: "Platform",
  sending: "Sending",
  devices: "Devices",
  lastTest: "Last test",
  sendTest: "Send test",
  testAll: "Test all platforms",
  viewDevices: "View devices",
  needsWebConfig: "Needs web config",
  notTested: "Not tested yet",
  testFailedToast: "The test could not be sent.",
} as const;

export const WEB_TEXT = {
  title: "Web config",
  notStored: "Not stored yet",
  stored: "Web config stored",
  source: "How to add the web config",
  paste: "Paste firebaseConfig",
  upload: "Upload / paste config",
  fields: "Enter fields",
  chooseFile: "Choose file",
  pasteLabel: "Paste the firebaseConfig here",
  pastePlaceholder: "Drop a .json or .js file, choose a file or paste here",
  added: "Config added · values hidden",
  remove: "Remove",
  apiKey: "API key",
  appId: "App ID",
  senderId: "Sender ID",
  vapid: "VAPID public key",
  vapidPaste: "VAPID public key (not in firebaseConfig)",
  help: "Stored securely in the secret store. It is never displayed again.",
  foundFields: "apiKey, appId, messagingSenderId found",
  sameProject: "Same Firebase project as the service account key",
  vapidEntered: "VAPID public key entered",
  ignored: "Other fields in the snippet (authDomain, storageBucket) are ignored.",
  allFilled: "All 4 filled · formats look right",
  saved: "Web config saved.",
  removedWithKey: "Stored web config",
} as const;

export const WEB_PROBLEM_TEXT = {
  notConfig: "This is not a Firebase web config.",
  needConfig: "Paste or upload the firebaseConfig first.",
  otherProject: "This config is for another Firebase project.",
  needVapid: "Add the VAPID public key.",
  needKey: "Set up the service account key first.",
  fillAll: "Fill in all 4 fields.",
  appIdFormat: "App ID looks wrong (expected 1:<number>:web:<id>).",
  valueFormat: "A value looks wrong. Copy it again from the Firebase console.",
  otherSender: "App ID belongs to another sender.",
} as const;

export const TEST_DIALOG_TEXT = {
  title: "Test result",
  close: "Close",
  sendAgain: "Send again",
  lastSeen: "last seen",
  noName: "Unnamed device",
  failed: "The test could not be sent.",
} as const;

export const DEVICES_TEXT = {
  title: "Registered devices",
  back: "Push",
  subtitle: "Devices the apps registered for push. Unused devices are removed after 60 days.",
  filter: "Platform filter",
  all: "All",
  search: "Search user",
  user: "User",
  platform: "Platform",
  device: "Device",
  lastSeen: "Last seen",
  remove: "Remove",
  note: "Removing a device stops push to it until the app registers again.",
  empty: "No devices match.",
  loadFailed: "The devices could not be loaded.",
  confirmTitle: "Remove this device?",
  confirmBody: "Push to this device stops until the app registers again. Nothing else is deleted.",
  confirmYes: "Remove",
  removed: "Device removed.",
  previous: "Previous",
  next: "Next",
} as const;

export const PUSH_FORM_TEXT = {
  platforms: "Push platforms",
  platformsHelp: "Only platforms turned on in Push settings are shown as active.",
  offInSettings: "off in settings",
  atLeastOne: "Select at least one push platform.",
  openOnTap: "Open on tap",
  appLink: "App link (Android and iOS)",
  webLink: "Web link",
  webLinkError: "The web link must start with https:// and be at most 500 characters.",
  options: "Platform options",
  optionsHelp: "Optional. Empty fields use the defaults.",
  optionsAria: "Platform",
  previewTitle: "Preview and test",
  previewHelp: "Send this notification to your own devices with sample data.",
  sendTest: "Send test to my devices",
  needKeys: "Choose a title key and a message key first.",
  default: "Default",
  textError:
    "Channel, sound, group and replace key use only letters, numbers and . _ - { } (up to 100 characters).",
  colorError: "Icon colour must look like #0B5CAD.",
  badgeError: "Badge number must be a whole number from 0 to 9999.",
  iconError: "The web icon must start with https:// and be at most 500 characters.",
} as const;

const EXPIRES = "Expires after";

export const ANDROID_FIELDS = {
  priority: "Priority",
  channel: "Notification channel",
  sound: "Sound",
  expires: EXPIRES,
  collapseKey: "Replace earlier push with key",
  color: "Icon colour",
} as const;

export const IOS_FIELDS = {
  sound: "Sound",
  badge: "Badge number",
  priority: "Priority",
  interruption: "Interruption level",
  thread: "Group (thread)",
  expires: EXPIRES,
} as const;

export const WEB_FIELDS = {
  icon: "Icon",
  requireInteraction: "Stay until clicked",
  urgency: "Urgency",
  expires: EXPIRES,
} as const;

export interface IOption {
  value: string;
  label: string;
}

/** Empty value = server default. Radix Select cannot hold "", so DEFAULT_VALUE stands for it. */
export const DEFAULT_VALUE = "__default";

export const PRIORITY_OPTIONS: IOption[] = [
  { value: "high", label: "High — show now" },
  { value: "normal", label: "Normal" },
];

export const INTERRUPTION_OPTIONS: IOption[] = [
  { value: "active", label: "Active (normal)" },
  { value: "time-sensitive", label: "Time-sensitive" },
  { value: "passive", label: "Passive (quiet)" },
];

export const URGENCY_OPTIONS: IOption[] = [
  { value: "very-low", label: "Very low" },
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
];

export const EXPIRY_OPTIONS: IOption[] = [
  { value: "3600", label: "1 hour" },
  { value: "86400", label: "1 day" },
  { value: "604800", label: "1 week" },
  { value: "2419200", label: "4 weeks" },
];

export const MAX_TTL_SECONDS = 2_419_200;
