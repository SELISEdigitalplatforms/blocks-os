import { describe, expect, it } from "vitest";
import {
  formatBoolean,
  formatList,
  formatMinutes,
  formatNumber,
  formatText,
  joinAccountActionUrl,
} from "./format-config";

describe("format-config", () => {
  describe("formatBoolean", () => {
    it("maps true/false to Yes/No", () => {
      expect(formatBoolean(true)).toBe("Yes");
      expect(formatBoolean(false)).toBe("No");
    });
    it("treats null/undefined as No", () => {
      expect(formatBoolean(null)).toBe("No");
      expect(formatBoolean(undefined)).toBe("No");
    });
  });

  describe("formatList", () => {
    it("joins values with a comma", () => {
      expect(formatList(["a", "b"])).toBe("a, b");
    });
    it("returns None for empty or nullish lists", () => {
      expect(formatList([])).toBe("None");
      expect(formatList(null)).toBe("None");
      expect(formatList(undefined)).toBe("None");
    });
  });

  describe("formatMinutes", () => {
    it("appends the minutes suffix", () => {
      expect(formatMinutes(30)).toBe("30 minutes");
    });
    it("defaults nullish to 0", () => {
      expect(formatMinutes(null)).toBe("0 minutes");
      expect(formatMinutes(undefined)).toBe("0 minutes");
    });
  });

  describe("formatNumber", () => {
    it("stringifies numbers and defaults nullish to 0", () => {
      expect(formatNumber(42)).toBe("42");
      expect(formatNumber(null)).toBe("0");
    });
  });

  describe("formatText", () => {
    it("returns an em dash for empty values", () => {
      expect(formatText("")).toBe("—");
      expect(formatText(null)).toBe("—");
      expect(formatText(undefined)).toBe("—");
    });
    it("returns the value when present", () => {
      expect(formatText("hello")).toBe("hello");
      expect(formatText(0)).toBe(0);
    });
  });

  describe("joinAccountActionUrl", () => {
    it("returns an em dash when both parts are missing", () => {
      expect(joinAccountActionUrl(undefined, undefined)).toBe("—");
    });
    it("returns the available part when the other is missing", () => {
      expect(joinAccountActionUrl(undefined, "/path")).toBe("/path");
      expect(joinAccountActionUrl("https://base", undefined)).toBe("https://base");
    });
    it("joins base and path, normalizing slashes", () => {
      expect(joinAccountActionUrl("https://base/", "/path")).toBe("https://base/path");
    });
  });
});
