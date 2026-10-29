import type {
  IPushNotificationTestRequest,
  IPushOptions,
  PushPlatform,
} from "../models/push.model";
import { PUSH_PLATFORMS } from "../models/push.model";
import { PUSH_FORM_TEXT } from "../constants/push-ui.constant";

/** Form state of the per-platform options. Text is kept as typed; empty means the default. */
export interface PushOptionValues {
  webLink: string;
  android: {
    priority: string;
    channelId: string;
    sound: string;
    ttl: string;
    collapseKey: string;
    color: string;
  };
  ios: {
    sound: string;
    badge: string;
    priority: string;
    interruptionLevel: string;
    threadId: string;
    ttl: string;
  };
  web: { icon: string; requireInteraction: boolean; urgency: string; ttl: string };
}

export const EMPTY_PUSH_OPTIONS: PushOptionValues = {
  webLink: "",
  android: { priority: "", channelId: "", sound: "", ttl: "", collapseKey: "", color: "" },
  ios: { sound: "", badge: "", priority: "", interruptionLevel: "", threadId: "", ttl: "" },
  web: { icon: "", requireInteraction: false, urgency: "", ttl: "" },
};

const MAX_TEXT = 100;
const MAX_LINK = 500;
const TOKEN = /^[A-Za-z0-9._{}-]*$/;
const COLOR = /^#[0-9A-Fa-f]{6}$/;
const BADGE = /^\d{1,4}$/;

const text = (value: string | null | undefined) => value ?? "";
const num = (value: number | null | undefined) => (value == null ? "" : String(value));

/** Missing or empty platforms read as all three, like the server does. */
export const toPushPlatforms = (stored: PushPlatform[] | null | undefined): PushPlatform[] =>
  stored?.length
    ? PUSH_PLATFORMS.filter((platform) => stored.includes(platform))
    : [...PUSH_PLATFORMS];

export const toPushOptionValues = (options: IPushOptions | null | undefined): PushOptionValues => ({
  webLink: text(options?.webLink),
  android: {
    priority: text(options?.android?.priority),
    channelId: text(options?.android?.channelId),
    sound: text(options?.android?.sound),
    ttl: num(options?.android?.ttlSeconds),
    collapseKey: text(options?.android?.collapseKey),
    color: text(options?.android?.color),
  },
  ios: {
    sound: text(options?.ios?.sound),
    badge: num(options?.ios?.badge),
    priority: text(options?.ios?.priority),
    interruptionLevel: text(options?.ios?.interruptionLevel),
    threadId: text(options?.ios?.threadId),
    ttl: num(options?.ios?.ttlSeconds),
  },
  web: {
    icon: text(options?.web?.icon),
    requireInteraction: options?.web?.requireInteraction ?? false,
    urgency: text(options?.web?.urgency),
    ttl: num(options?.web?.ttlSeconds),
  },
});

/** Keeps the entries the user filled; null when none, so a cleared tab clears the stored options. */
const nonEmpty = <T extends object>(entries: Record<string, unknown>): T | null => {
  const kept = Object.entries(entries).filter(([, value]) => value !== undefined && value !== "");
  return kept.length > 0 ? (Object.fromEntries(kept) as T) : null;
};

const trimmed = (value: string) => value.trim() || undefined;
const whole = (value: string) => (value.trim() ? Number(value) : undefined);

/** The `pushOptions` of the save request (contract section 2). Empty fields are left out. */
export const buildPushOptions = (values: PushOptionValues): IPushOptions => {
  const { android, ios, web } = values;
  return {
    webLink: trimmed(values.webLink) ?? null,
    android: nonEmpty({
      priority: android.priority,
      channelId: trimmed(android.channelId),
      sound: trimmed(android.sound),
      ttlSeconds: whole(android.ttl),
      collapseKey: trimmed(android.collapseKey),
      color: trimmed(android.color),
    }),
    ios: nonEmpty({
      sound: trimmed(ios.sound),
      badge: whole(ios.badge),
      priority: ios.priority,
      interruptionLevel: ios.interruptionLevel,
      threadId: trimmed(ios.threadId),
      ttlSeconds: whole(ios.ttl),
    }),
    web: nonEmpty({
      icon: trimmed(web.icon),
      requireInteraction: web.requireInteraction || undefined,
      urgency: web.urgency,
      ttlSeconds: whole(web.ttl),
    }),
  };
};

const badToken = (value: string) => value.length > MAX_TEXT || !TOKEN.test(value);
const badHttps = (value: string) =>
  !!value && (value.length > MAX_LINK || !/^https:\/\/\S+$/.test(value));

/** One message per broken rule; the form shows them next to Save. The server checks the same limits. */
export const pushOptionsErrors = (values: PushOptionValues): string[] => {
  const { android, ios, web } = values;
  const errors: string[] = [];
  if (badHttps(values.webLink.trim())) errors.push(PUSH_FORM_TEXT.webLinkError);
  const tokens = [
    android.channelId,
    android.sound,
    android.collapseKey,
    ios.sound,
    ios.threadId,
  ].map((value) => value.trim());
  if (tokens.some((value) => badToken(value))) errors.push(PUSH_FORM_TEXT.textError);
  if (android.color.trim() && !COLOR.test(android.color.trim())) {
    errors.push(PUSH_FORM_TEXT.colorError);
  }
  if (ios.badge.trim() && !BADGE.test(ios.badge.trim())) errors.push(PUSH_FORM_TEXT.badgeError);
  if (badHttps(web.icon.trim())) errors.push(PUSH_FORM_TEXT.iconError);
  return errors;
};

/** Body of the "Send test to my devices" call: the unsaved draft of the form. */
export const buildNotificationTestRequest = (draft: {
  titleKey: string;
  bodyKey: string;
  link: string;
  pushPlatforms: PushPlatform[];
  pushOptions: PushOptionValues;
}): IPushNotificationTestRequest => {
  const options = buildPushOptions(draft.pushOptions);
  return {
    titleKey: draft.titleKey,
    bodyKey: draft.bodyKey,
    link: trimmed(draft.link),
    webLink: options.webLink ?? undefined,
    platforms: draft.pushPlatforms,
    options: { android: options.android, ios: options.ios, web: options.web },
  };
};
