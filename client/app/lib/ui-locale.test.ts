import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDistanceToNow } from "date-fns";
import { relativeTimeFromNow, uiDateLocale } from "./ui-locale";

describe("uiDateLocale", () => {
  it("keeps the UK day-first locale for English", () => {
    expect(uiDateLocale("en")).toBe("en-GB");
    expect(uiDateLocale("en-US")).toBe("en-GB");
    expect(uiDateLocale(undefined)).toBe("en-GB");
  });

  it("uses the shown language's own locale for any other language", () => {
    expect(uiDateLocale("fr")).toBe("fr");
    expect(uiDateLocale("fa-IR")).toBe("fa-IR");
  });

  it("falls back to English for a code the browser does not know", () => {
    expect(uiDateLocale("not a locale")).toBe("en-GB");
  });
});

describe("relativeTimeFromNow", () => {
  afterEach(() => vi.useRealTimers());

  it("keeps the date-fns wording for English", () => {
    const date = new Date(Date.now() - 3 * 3600 * 1000);
    expect(relativeTimeFromNow(date, "en")).toBe(formatDistanceToNow(date, { addSuffix: true }));
  });

  it("uses Intl.RelativeTimeFormat for other languages", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
    const date = new Date("2026-11-03T09:00:00Z");
    expect(relativeTimeFromNow(date, "fr")).toBe(
      new Intl.RelativeTimeFormat("fr", { numeric: "auto" }).format(-3, "hour"),
    );
  });
});
