import { describe, expect, it } from "vitest";
import {
  deviceCountText,
  formatDate,
  formatDateTime,
  isStaleDevice,
  lastSeenText,
  timeAgo,
} from "./push-format";

const ISO = "2026-10-28T12:00:00Z";
const NOW = Date.parse(ISO);
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("push-format", () => {
  it("timeAgo: just now, minutes, hours and days, with singular and plural", () => {
    expect(timeAgo(ago(30_000), NOW)).toBe("just now");
    expect(timeAgo(ago(5 * MINUTE), NOW)).toBe("5 min ago");
    expect(timeAgo(ago(HOUR), NOW)).toBe("1 hour ago");
    expect(timeAgo(ago(3 * HOUR), NOW)).toBe("3 hours ago");
    expect(timeAgo(ago(2 * DAY), NOW)).toBe("2 days ago");
  });

  it("timeAgo: a time in the future reads as just now", () => {
    expect(timeAgo(ago(-5 * MINUTE), NOW)).toBe("just now");
  });

  it("shows nothing for a missing or broken date", () => {
    for (const value of [null, undefined, "", "not a date"]) {
      expect(timeAgo(value, NOW)).toBe("");
      expect(formatDate(value)).toBe("");
      expect(formatDateTime(value)).toBe("");
      expect(lastSeenText(value, NOW)).toBe("");
      expect(isStaleDevice(value, NOW)).toBe(false);
    }
  });

  it("formats the date day first", () => {
    expect(formatDate(ISO)).toMatch(/^28\/10\/2026$/);
    expect(formatDateTime(ISO)).toMatch(/^28\/10\/2026 \d{2}:\d{2}$/);
  });

  it("last seen: today inside one day, else days ago", () => {
    expect(lastSeenText(ago(3 * HOUR), NOW)).toBe("today");
    expect(lastSeenText(ago(3 * DAY), NOW)).toBe("3 days ago");
  });

  it("a device is stale after 45 days, not before", () => {
    expect(isStaleDevice(ago(44 * DAY), NOW)).toBe(false);
    expect(isStaleDevice(ago(46 * DAY), NOW)).toBe(true);
  });

  it("counts devices in singular and plural", () => {
    expect(deviceCountText(1)).toBe("1 device");
    expect(deviceCountText(0)).toBe("0 devices");
  });
});
