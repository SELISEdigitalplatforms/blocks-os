const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? "" : "s"}`;

const validDate = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** 28/10/2026 */
export const formatDate = (iso: string | null | undefined): string => {
  const date = validDate(iso);
  return date ? date.toLocaleDateString("en-GB") : "";
};

/** 28/10/2026 20:41 */
export const formatDateTime = (iso: string | null | undefined): string => {
  const date = validDate(iso);
  if (!date) return "";
  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date.toLocaleDateString("en-GB")} ${time}`;
};

/** "just now", "2 min ago", "3 hours ago", "2 days ago"; empty when the date is unknown. */
export const timeAgo = (iso: string | null | undefined, now = Date.now()): string => {
  const date = validDate(iso);
  if (!date) return "";
  const elapsed = Math.max(0, now - date.getTime());
  if (elapsed < MINUTE_MS) return "just now";
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)} min ago`;
  if (elapsed < DAY_MS) return `${plural(Math.floor(elapsed / HOUR_MS), "hour")} ago`;
  return `${plural(Math.floor(elapsed / DAY_MS), "day")} ago`;
};

/** Device last seen: "today" inside one day, else "N days ago". */
export const lastSeenText = (iso: string | null | undefined, now = Date.now()): string => {
  const date = validDate(iso);
  if (!date) return "";
  return now - date.getTime() < DAY_MS ? "today" : timeAgo(iso, now);
};

/** Devices not seen for this many days are close to the 60-day clean-up. */
export const STALE_DEVICE_DAYS = 45;

export const isStaleDevice = (iso: string | null | undefined, now = Date.now()): boolean => {
  const date = validDate(iso);
  return !!date && now - date.getTime() > STALE_DEVICE_DAYS * DAY_MS;
};

export const deviceCountText = (count: number): string => plural(count, "device");
