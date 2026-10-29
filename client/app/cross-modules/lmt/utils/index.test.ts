import { describe, expect, it } from "vitest";
import {
  LOG_LEVEL,
  formatDurationMs,
  getLogFormatTimestamp,
  getLogLevelClassName,
  getLogLevelLabel,
  getTraceFormatTimestamp,
  getRangeStartDate,
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

  describe("getLogLevelLabel", () => {
    it("shortens Information to INFO", () => {
      expect(getLogLevelLabel("Information")).toBe("INFO");
    });

    it("shortens Warning to WARN", () => {
      expect(getLogLevelLabel("Warning")).toBe("WARN");
    });

    it("leaves already-short levels unchanged", () => {
      expect(getLogLevelLabel("Error")).toBe("Error");
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

  describe("getRangeStartDate", () => {
    it("returns undefined when no range is selected", () => {
      expect(getRangeStartDate("")).toBeUndefined();
      expect(getRangeStartDate("nonsense")).toBeUndefined();
    });

    it("subtracts the preset window from now", () => {
      const now = new Date("2026-09-07T20:48:13.017Z");
      expect(getRangeStartDate("15m", now)).toBe("2026-09-07T20:33:00.000Z");
      expect(getRangeStartDate("1h", now)).toBe("2026-09-07T19:48:00.000Z");
      expect(getRangeStartDate("24h", now)).toBe("2026-09-06T20:48:00.000Z");
    });

    it("floors to the minute so the react-query key is stable between renders", () => {
      // Without this, every render would produce a new start date, a new query key, and a
      // refetch loop. Two moments in the same minute must resolve identically.
      const early = getRangeStartDate("5m", new Date("2026-09-07T20:48:00.001Z"));
      const late = getRangeStartDate("5m", new Date("2026-09-07T20:48:59.999Z"));
      expect(early).toBe(late);
    });

    it("rolls over at the minute boundary so the window keeps tracking now", () => {
      const before = getRangeStartDate("5m", new Date("2026-09-07T20:48:59.999Z"));
      const after = getRangeStartDate("5m", new Date("2026-09-07T20:49:00.000Z"));
      expect(after).not.toBe(before);
    });
  });

  describe("formatDurationMs", () => {
    it("trims driver precision to two decimals", () => {
      expect(formatDurationMs(10.6521)).toBe("10.65 ms");
      expect(formatDurationMs(0)).toBe("0.00 ms");
    });

    it("switches to seconds once milliseconds stop being readable", () => {
      expect(formatDurationMs(1000)).toBe("1.00 s");
      expect(formatDurationMs(1016.0493)).toBe("1.02 s");
    });

    it("parses a numeric string, which the restore path can produce", () => {
      expect(formatDurationMs("125")).toBe("125.00 ms");
    });

    it("falls back to a dash for a value it cannot read", () => {
      expect(formatDurationMs("not-a-number")).toBe("—");
      expect(formatDurationMs(Number.NaN)).toBe("—");
    });
  });
});
