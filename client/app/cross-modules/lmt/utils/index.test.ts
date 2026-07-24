import { describe, expect, it } from "vitest";
import { LOG_LEVEL, getLogFormatTimestamp, getLogLevelClassName } from "./index";

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
});
