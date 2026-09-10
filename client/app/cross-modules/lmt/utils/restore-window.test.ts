import { describe, expect, it } from "vitest";
import { formatRestoreWindow, restoreWindowBounds } from "./restore-window";

describe("formatRestoreWindow", () => {
  it("reads a window that sits inside one month", () => {
    expect(formatRestoreWindow("2026-08-01T00:00:00Z", "2026-08-07T00:00:00Z")).toBe(
      "Aug 1 – Aug 7, 2026",
    );
  });

  it("reads a window that crosses a month", () => {
    expect(formatRestoreWindow("2026-08-30T00:00:00Z", "2026-09-02T00:00:00Z")).toBe(
      "Aug 30 – Sep 2, 2026",
    );
  });

  it("carries both years when the window crosses one", () => {
    expect(formatRestoreWindow("2025-12-28T00:00:00Z", "2026-01-03T00:00:00Z")).toBe(
      "Dec 28, 2025 – Jan 3, 2026",
    );
  });

  it("reads a single restored day as one date", () => {
    expect(formatRestoreWindow("2026-08-03T00:00:00Z", "2026-08-03T00:00:00Z")).toBe("Aug 3, 2026");
  });

  /**
   * Restored rows are listed in UTC and the range is a UTC calendar range, so formatting it in
   * the viewer's zone would name days the restore does not cover. These two bounds catch that in
   * either direction: the late one shifts forward east of Greenwich, the early one back west of it.
   */
  it("names UTC days rather than the viewer's local days", () => {
    expect(formatRestoreWindow("2026-08-01T00:30:00Z", "2026-08-07T23:30:00Z")).toBe(
      "Aug 1 – Aug 7, 2026",
    );
  });

  it("says nothing until both ends are known", () => {
    expect(formatRestoreWindow(undefined, "2026-08-07T00:00:00Z")).toBe("");
    expect(formatRestoreWindow("2026-08-01T00:00:00Z", undefined)).toBe("");
    expect(formatRestoreWindow("", "")).toBe("");
    expect(formatRestoreWindow("not-a-date", "2026-08-07T00:00:00Z")).toBe("");
  });
});

describe("restoreWindowBounds", () => {
  /**
   * The picker's calendar speaks local Date objects carrying the UTC calendar parts, the same
   * frame the time-range control converts its instants into.
   */
  it("bounds the picker to the restored days", () => {
    const { min, max } = restoreWindowBounds("2026-08-01T00:00:00Z", "2026-08-07T00:00:00Z");

    expect(min).toEqual(new Date(2026, 7, 1));
    expect(max).toEqual(new Date(2026, 7, 7));
  });

  /**
   * A restore covers its end day in full -- the worker walks dates while `current <= endDate.Date`
   * -- so the last day has to stay selectable rather than being cut off at its midnight.
   */
  it("keeps the last restored day selectable", () => {
    const { max } = restoreWindowBounds("2026-08-01T00:00:00Z", "2026-08-07T00:00:00Z");

    expect(max?.getDate()).toBe(7);
  });

  it("has no bounds to enforce until the window is known", () => {
    expect(restoreWindowBounds(undefined, undefined)).toEqual({ min: undefined, max: undefined });
    expect(restoreWindowBounds("not-a-date", "also-not")).toEqual({
      min: undefined,
      max: undefined,
    });
  });
});
