import { afterEach, describe, expect, it } from "vitest";
import { parseCalendarDay, toUtcCalendarDay } from "./restore-date-range";

describe("toUtcCalendarDay", () => {
  const originalTimeZone = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTimeZone;
  });

  /**
   * The regression this guards. The modal used to serialize a picked day with
   * `startOfDay(date).toISOString()`, which converts local midnight to UTC. At UTC+6 a picked
   * Sep 5 became `2026-09-04T18:00:00Z`; the API compares dates, so the restore ran for Sep 4 —
   * or was refused for falling outside the cold window. West of Greenwich it shifted the other
   * way. Only UTC was correct.
   *
   * The input below is exactly what react-day-picker hands over: local midnight of the day the
   * user clicked.
   */
  it.each([
    ["UTC", "UTC"],
    ["Asia/Dhaka", "UTC+6"],
    ["Asia/Kolkata", "UTC+5:30"],
    ["Pacific/Auckland", "UTC+13"],
    ["America/New_York", "UTC-4"],
    ["America/Los_Angeles", "UTC-7"],
  ])("keeps the picked calendar day in %s (%s)", (timeZone) => {
    process.env.TZ = timeZone;

    expect(toUtcCalendarDay(new Date(2026, 8, 5))).toBe("2026-09-05T00:00:00Z");
    expect(toUtcCalendarDay(new Date(2026, 8, 8))).toBe("2026-09-08T00:00:00Z");
  });

  it("ignores a time component on the picked date", () => {
    // react-day-picker gives local midnight, but a range's end can arrive with a time attached.
    expect(toUtcCalendarDay(new Date(2026, 8, 8, 23, 59, 59))).toBe("2026-09-08T00:00:00Z");
  });
});

describe("parseCalendarDay", () => {
  const originalTimeZone = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTimeZone;
  });

  /**
   * `new Date("2026-09-05")` parses as UTC midnight, which is Sep 4 in every zone west of
   * Greenwich — the calendar would then bound and highlight the wrong day.
   */
  it.each([
    ["UTC", "UTC"],
    ["Asia/Dhaka", "UTC+6"],
    ["America/Los_Angeles", "UTC-7"],
  ])("reads an API bound as that day in local time in %s (%s)", (timeZone) => {
    process.env.TZ = timeZone;

    const parsed = parseCalendarDay("2026-09-05")!;

    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(8);
    expect(parsed.getDate()).toBe(5);
  });

  it("returns undefined when the API has not answered yet", () => {
    expect(parseCalendarDay(undefined)).toBeUndefined();
    expect(parseCalendarDay("")).toBeUndefined();
  });

  it("round-trips a bound back to the same wire value", () => {
    expect(toUtcCalendarDay(parseCalendarDay("2026-09-05")!)).toBe("2026-09-05T00:00:00Z");
  });
});
