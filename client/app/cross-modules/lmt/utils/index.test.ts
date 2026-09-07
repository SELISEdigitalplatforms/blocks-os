import { describe, expect, it } from "vitest";
import {
  LOG_LEVEL,
  getLogFormatTimestamp,
  getLogLevelClassName,
  getTraceFormatTimestamp,
} from "./index";

describe("lmt/utils index", () => {
  describe("LOG_LEVEL", () => {
    it("exposes the known log levels", () => {
      expect(LOG_LEVEL).toEqual({
        Information: "Information",
        Warning: "Warning",
        Error: "Error",
      });
    });
  });

  describe("getLogFormatTimestamp", () => {
    it("formats an ISO timestamp into 'YYYY-MM-DD HH:mm:ss'", () => {
      expect(getLogFormatTimestamp("2026-01-15T10:30:45.123Z")).toBe("2026-01-15 10:30:45");
    });

    it("returns the original string when it is not a valid date", () => {
      expect(getLogFormatTimestamp("not-a-timestamp")).toBe("not-a-timestamp");
    });
  });

  describe("getLogLevelClassName", () => {
    it.each([
      ["Warning", "text-warning"],
      ["Information", "text-success"],
      ["Error", "text-error"],
    ])("maps %s to %s", (level, expected) => {
      expect(getLogLevelClassName(level)).toBe(expected);
    });

    it("falls back to high-emphasis for unknown levels", () => {
      expect(getLogLevelClassName("Debug")).toBe("text-high-emphasis");
    });
  });

  describe("getTraceFormatTimestamp", () => {
    it("keeps seconds and milliseconds so same-minute traces stay distinguishable", () => {
      const first = getTraceFormatTimestamp(new Date(2026, 8, 7, 20, 25, 3, 7).toISOString());
      const second = getTraceFormatTimestamp(new Date(2026, 8, 7, 20, 25, 3, 41).toISOString());

      expect(first).toBe("07/09/2026, 20:25:03.007");
      expect(second).toBe("07/09/2026, 20:25:03.041");
      expect(first).not.toBe(second);
    });

    it("returns the original string when it is not a valid date", () => {
      expect(getTraceFormatTimestamp("not-a-timestamp")).toBe("not-a-timestamp");
    });
  });
});
