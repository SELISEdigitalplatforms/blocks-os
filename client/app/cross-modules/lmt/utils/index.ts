export const LOG_LEVEL = {
  Information: "Information",
  Warning: "Warning",
  Error: "Error",
};

export * from "./usage.util";
export * from "./service-selection.util";

export const getLogFormatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toISOString().replace("T", " ").replace("Z", "").slice(0, -4);
};

/** Relative windows shared by the logs and traces filters, coarsest unit last. */
export const LMT_TIME_RANGES = [
  { label: "Last 5 minutes", value: "5m", minutes: 5 },
  { label: "Last 15 minutes", value: "15m", minutes: 15 },
  { label: "Last 30 minutes", value: "30m", minutes: 30 },
  { label: "Last hour", value: "1h", minutes: 60 },
  { label: "Last 6 hours", value: "6h", minutes: 6 * 60 },
  { label: "Last 24 hours", value: "24h", minutes: 24 * 60 },
] as const;

export const TRACE_STATUS_CLASSES = [
  { label: "2xx Success", value: "2" },
  { label: "3xx Redirect", value: "3" },
  { label: "4xx Client error", value: "4" },
  { label: "5xx Server error", value: "5" },
] as const;

/**
 * Start of a relative window, as an ISO string, or undefined when no range is selected.
 *
 * "Now" is floored to the current minute on purpose. This value goes into the react-query
 * key, so an unrounded Date.now() would produce a new key on every render and refetch in a
 * loop. Flooring makes the key stable within a minute and lets it roll over once a minute,
 * which also keeps a "last 15 minutes" view moving without any polling.
 */
export const getRangeStartDate = (range: string, now: Date = new Date()) => {
  const preset = LMT_TIME_RANGES.find((option) => option.value === range);
  if (!preset) return undefined;

  const flooredNow = new Date(now);
  flooredNow.setSeconds(0, 0);
  return new Date(flooredNow.getTime() - preset.minutes * 60_000).toISOString();
};

/**
 * Local-time timestamp carrying seconds and milliseconds. Matches the shared formatDate
 * shape, but traces routinely land within the same minute -- and often the same second --
 * so stopping at minutes made consecutive requests look simultaneous.
 */
export const getTraceFormatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    return timestamp;
  }
  const pad = (value: number, width = 2) => String(value).padStart(width, "0");
  const day = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${day}, ${time}.${pad(date.getMilliseconds(), 3)}`;
};

/**
 * Log level as a design-system badge variant. Levels are a small closed set with clear
 * severity, so they read faster as a chip than as coloured text in the flow of the row.
 */
export const getLogLevelBadgeVariant = (level: string) => {
  switch (level) {
    case "Error":
    case "Fatal":
      return "error" as const;
    case "Warning":
      return "warning" as const;
    case "Information":
      return "success" as const;
    default:
      return "secondary" as const;
  }
};

/**
 * Durations arrive with sub-microsecond precision (10.6521ms), which is noise at this scale
 * and makes a column impossible to compare down. Two decimals, and seconds once a request
 * is slow enough that milliseconds stop being readable.
 */
export const formatDurationMs = (duration: number | string) => {
  // Coerced rather than trusted: the restore path stores some numeric fields as strings, and
  // rendering a dash for a perfectly good "125" would be a worse answer than parsing it.
  const value = typeof duration === "string" ? Number(duration) : duration;
  if (!Number.isFinite(value)) return "—";
  return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${value.toFixed(2)} ms`;
};

export const getLogLevelClassName = (level: string) => {
  switch (level) {
    case "Warning":
      return "text-warning";
    case "Information":
      return "text-success";
    case "Error":
      return "text-error";
    default:
      return "text-high-emphasis";
  }
};
