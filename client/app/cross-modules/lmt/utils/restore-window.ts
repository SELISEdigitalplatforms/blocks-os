/**
 * The window a completed cold or archive restore covers.
 *
 * Both ends arrive from the status endpoint as UTC calendar days, and the restored rows are
 * listed in UTC, so everything here reads the UTC parts of an instant rather than the viewer's
 * local ones -- formatting locally would name days the restore does not actually cover.
 */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const parseUtcDay = (value?: string) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const dayLabel = (date: Date) => `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;

/**
 * Reads a restored window as a single phrase -- "Aug 1 – Aug 7, 2026" -- dropping the parts that
 * repeat and keeping both years when the window crosses one. Empty until both ends are known,
 * so a partially loaded status renders nothing rather than half a range.
 */
export const formatRestoreWindow = (startDate?: string, endDate?: string) => {
  const start = parseUtcDay(startDate);
  const end = parseUtcDay(endDate);
  if (!start || !end) return "";

  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();

  if (startYear !== endYear) {
    return `${dayLabel(start)}, ${startYear} – ${dayLabel(end)}, ${endYear}`;
  }

  const sameDay =
    start.getUTCMonth() === end.getUTCMonth() && start.getUTCDate() === end.getUTCDate();

  return sameDay
    ? `${dayLabel(start)}, ${endYear}`
    : `${dayLabel(start)} – ${dayLabel(end)}, ${endYear}`;
};

/**
 * The days a reader may narrow to, as the calendar-frame dates the time-range picker compares
 * against: a local Date carrying the UTC calendar parts. The end day is included in full, because
 * the restore walks dates up to and including it.
 */
export const restoreWindowBounds = (startDate?: string, endDate?: string) => {
  const start = parseUtcDay(startDate);
  const end = parseUtcDay(endDate);

  return {
    min: start
      ? new Date(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
      : undefined,
    max: end ? new Date(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) : undefined,
  };
};
