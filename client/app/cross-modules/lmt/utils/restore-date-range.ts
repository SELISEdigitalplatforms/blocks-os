import { format, parse } from "date-fns";

/**
 * Serializes a day the user picked for a restore request.
 *
 * The API compares calendar dates, so a picked day has to travel as a calendar day. Converting
 * the Date to an instant instead — `startOfDay(date).toISOString()` — reinterprets local midnight
 * in UTC and lands on the previous day everywhere east of Greenwich and, for an end-of-day
 * timestamp, the next day west of it. Formatting the local components sidesteps the conversion
 * entirely.
 */
export const toUtcCalendarDay = (date: Date) => `${format(date, "yyyy-MM-dd")}T00:00:00Z`;

/**
 * Reads a "yyyy-MM-dd" bound from the API as that calendar day in local time, which is the frame
 * the calendar renders and compares in. `new Date("2026-09-05")` parses as UTC midnight and so
 * draws as Sep 4 west of Greenwich, shifting every bound by a day.
 */
export const parseCalendarDay = (value?: string) =>
  value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
