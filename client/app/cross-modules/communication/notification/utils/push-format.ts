import { getLanguageCode } from "@seliseblocks/genesis-os";
import { tn } from "../i18n";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Date format of the shown language: day first in both English (UK) and German. */
const locale = () => (getLanguageCode() === "de" ? "de-DE" : "en-GB");

const validDate = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** 28/10/2026 */
export const formatDate = (iso: string | null | undefined): string => {
  const date = validDate(iso);
  return date ? date.toLocaleDateString(locale()) : "";
};

/** 28/10/2026 20:41 */
export const formatDateTime = (iso: string | null | undefined): string => {
  const date = validDate(iso);
  if (!date) return "";
  const time = date.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
  return `${date.toLocaleDateString(locale())} ${time}`;
};

/** "just now", "2 min ago", "3 hours ago", "2 days ago"; empty when the date is unknown. */
export const timeAgo = (iso: string | null | undefined, now = Date.now()): string => {
  const date = validDate(iso);
  if (!date) return "";
  const elapsed = Math.max(0, now - date.getTime());
  if (elapsed < MINUTE_MS) return tn("PUSH_FORMAT.JUST_NOW");
  if (elapsed < HOUR_MS)
    return tn("PUSH_FORMAT.MINUTES_AGO", { count: Math.floor(elapsed / MINUTE_MS) });
  if (elapsed < DAY_MS)
    return tn("PUSH_FORMAT.HOURS_AGO", { count: Math.floor(elapsed / HOUR_MS) });
  return tn("PUSH_FORMAT.DAYS_AGO", { count: Math.floor(elapsed / DAY_MS) });
};

/** Device last seen: "today" inside one day, else "N days ago". */
export const lastSeenText = (iso: string | null | undefined, now = Date.now()): string => {
  const date = validDate(iso);
  if (!date) return "";
  return now - date.getTime() < DAY_MS ? tn("PUSH_FORMAT.TODAY") : timeAgo(iso, now);
};

/** Devices not seen for this many days are close to the 60-day clean-up. */
export const STALE_DEVICE_DAYS = 45;

export const isStaleDevice = (iso: string | null | undefined, now = Date.now()): boolean => {
  const date = validDate(iso);
  return !!date && now - date.getTime() > STALE_DEVICE_DAYS * DAY_MS;
};

export const deviceCountText = (count: number): string => tn("PUSH_FORMAT.DEVICE_COUNT", { count });
