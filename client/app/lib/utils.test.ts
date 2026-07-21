import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cn,
  formatDate,
  formatFullDate,
  parseDateString,
  compareDates,
  BREADCRUMB_CUSTOM_TITLES,
  clearBreadCrumbTitleEntry,
  debounce,
  parseMongoDBString,
  checkValidDate,
  deepEqual,
  clearQueryString,
  toSnakeCase,
  getUniqueID,
  formatSize,
} from "./utils";

describe("lib/utils", () => {
  describe("cn", () => {
    it("merges class names and resolves tailwind conflicts", () => {
      expect(cn("px-2", "px-4")).toBe("px-4");
      expect(cn("text-sm", false && "hidden", "font-bold")).toBe("text-sm font-bold");
    });
  });

  describe("formatDate", () => {
    // 5 March 2026, 09:07 -> zero padding on day/month/hour/minute
    const date = new Date(2026, 2, 5, 9, 7);

    it("includes zero-padded date and time by default", () => {
      expect(formatDate(date)).toBe("05/03/2026, 09:07");
    });

    it("omits the time when withoutTime is true", () => {
      expect(formatDate(date, true)).toBe("05/03/2026");
    });
  });

  describe("formatFullDate", () => {
    const date = new Date(2026, 0, 15, 14, 30);

    it("uses the month name and includes the time", () => {
      expect(formatFullDate(date)).toBe("Jan 15, 2026 at 14:30");
    });

    it("omits the time when withoutTime is true", () => {
      expect(formatFullDate(date, true)).toBe("Jan 15, 2026");
    });
  });

  describe("parseDateString", () => {
    it("parses an ISO string into a Date", () => {
      const result = parseDateString("2026-01-15T00:00:00.000Z");
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(Date.parse("2026-01-15T00:00:00.000Z"));
    });
  });

  describe("compareDates", () => {
    it("returns a negative number when A is before B", () => {
      expect(compareDates("2026-01-01", "2026-01-02")).toBeLessThan(0);
    });
    it("returns a positive number when A is after B", () => {
      expect(compareDates("2026-01-02", "2026-01-01")).toBeGreaterThan(0);
    });
    it("returns 0 when dates are equal", () => {
      expect(compareDates("2026-01-01", "2026-01-01")).toBe(0);
    });
  });

  describe("clearBreadCrumbTitleEntry", () => {
    it("nulls the entry for the given path", () => {
      BREADCRUMB_CUSTOM_TITLES["/foo"] = "Foo";
      clearBreadCrumbTitleEntry("/foo");
      expect(BREADCRUMB_CUSTOM_TITLES["/foo"]).toBeNull();
    });
  });

  describe("debounce", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("invokes the function once after the delay", () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 200);
      debounced();
      debounced();
      debounced();
      expect(fn).not.toHaveBeenCalled();
      vi.advanceTimersByTime(200);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("passes the latest arguments", () => {
      const fn = vi.fn();
      const debounced = debounce(fn);
      debounced("a");
      debounced("b");
      vi.advanceTimersByTime(300);
      expect(fn).toHaveBeenCalledWith("b");
    });

    it("cancel prevents pending invocation", () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);
      debounced();
      debounced.cancel();
      vi.advanceTimersByTime(200);
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe("parseMongoDBString", () => {
    it("unwraps ISODate, ObjectId, $date and NumberLong tokens", () => {
      const input =
        'ObjectId("abc123") ISODate("2026-01-15") { "$date": "2026-02-01" } NumberLong(42)';
      expect(parseMongoDBString(input)).toBe(
        '"abc123" "2026-01-15" "2026-02-01" 42',
      );
    });
  });

  describe("checkValidDate", () => {
    it("returns true for a valid modern date", () => {
      expect(checkValidDate("2026-01-15")).toBe(true);
    });
    it("returns false for an invalid date string", () => {
      expect(checkValidDate("not-a-date")).toBe(false);
    });
    it("returns false for a date before 1900", () => {
      expect(checkValidDate("1800-01-01")).toBe(false);
    });
  });

  describe("deepEqual", () => {
    it("returns true for structurally equal objects", () => {
      expect(deepEqual({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } })).toBe(true);
    });
    it("returns true for identical references", () => {
      const obj = { a: 1 };
      expect(deepEqual(obj, obj)).toBe(true);
    });
    it("returns false when values differ", () => {
      expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    });
    it("returns false when key counts differ", () => {
      expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    });
    it("returns false when a key is missing", () => {
      expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
    });
    it("returns false when one side is null", () => {
      expect(deepEqual({ a: 1 }, null)).toBe(false);
    });
    it("returns false for differing primitives", () => {
      expect(deepEqual(1, 2)).toBe(false);
    });
  });

  describe("clearQueryString", () => {
    const original = window.location.href;
    afterEach(() => {
      window.history.replaceState(null, "", original);
    });

    it("removes all query params by default", () => {
      window.history.replaceState(null, "", "/page?a=1&b=2");
      clearQueryString();
      expect(window.location.search).toBe("");
    });

    it("keeps params listed in except", () => {
      window.history.replaceState(null, "", "/page?a=1&b=2&c=3");
      clearQueryString({ except: ["b"] });
      expect(window.location.search).toBe("?b=2");
    });
  });

  describe("toSnakeCase", () => {
    it("lowercases and joins with underscores", () => {
      expect(toSnakeCase("Test Role")).toBe("test_role");
    });
    it("collapses runs of punctuation and trims underscores", () => {
      expect(toSnakeCase("  Hello -- World!! ")).toBe("hello_world");
    });
  });

  describe("getUniqueID", () => {
    it("matches the BLK-<timestamp>-<letters> format", () => {
      expect(getUniqueID()).toMatch(/^BLK-\d+-[A-Z]{6}$/);
    });
    it("returns distinct ids on repeated calls", () => {
      const a = getUniqueID();
      const b = getUniqueID();
      expect(a).not.toBe(b);
    });
  });

  describe("formatSize", () => {
    it("formats bytes and scales up to larger units", () => {
      expect(formatSize(0)).toBe("0 B");
      expect(formatSize(1024)).toBe("1 KB");
      expect(formatSize(1024 * 1024)).toBe("1 MB");
    });
    it("respects the input unit", () => {
      expect(formatSize(1, "GB")).toBe("1 GB");
      expect(formatSize(1024, "KB")).toBe("1 MB");
    });
    it("respects the decimals argument", () => {
      expect(formatSize(1536, "B", 1)).toBe("1.5 KB");
    });
  });
});
