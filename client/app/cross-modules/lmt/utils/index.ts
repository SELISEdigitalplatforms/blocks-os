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
