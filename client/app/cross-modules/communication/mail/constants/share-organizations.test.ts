import { describe, expect, it } from "vitest";
import {
  MAX_COPY_ORGANIZATIONS,
  NO_SHARE,
  formatEditedOn,
  isShareReady,
  joinNames,
  toCopyRequest,
} from "./share-organizations";

// The English values of the list keys, so the joins read as the console shows them.
const t = (key: string, values: Readonly<Record<string, string | number>> = {}) => {
  const text: Record<string, string> = {
    "SHARE_WITH_ORGANIZATIONS.LIST_AND": "{{items}} and {{last}}",
    "SHARE_WITH_ORGANIZATIONS.LIST_MORE": "{{items}} and {{count}} more",
    "SHARE_WITH_ORGANIZATIONS.LIST_SEPARATOR": ", ",
  };
  return (text[key] ?? key).replace(/{{(\w+)}}/g, (_, name: string) => String(values[name]));
};

const selected = (count: number) =>
  new Map(Array.from({ length: count }, (_, index) => [`o${index}`, `Org ${index}`]));

describe("share choice helpers (SPEC33 §6.1, §6.4)", () => {
  it("is ready with no copy, all organizations, or 1 to 1000 selected (C8)", () => {
    expect(isShareReady(NO_SHARE)).toBe(true);
    expect(isShareReady({ ...NO_SHARE, copy: true, allOrganizations: true })).toBe(true);
    expect(isShareReady({ ...NO_SHARE, copy: true })).toBe(false);
    expect(isShareReady({ ...NO_SHARE, copy: true, selected: selected(1) })).toBe(true);
    expect(
      isShareReady({ ...NO_SHARE, copy: true, selected: selected(MAX_COPY_ORGANIZATIONS + 1) }),
    ).toBe(false);
  });

  it("builds the copy request, without ids for all organizations", () => {
    expect(
      toCopyRequest("d-1", { ...NO_SHARE, copy: true, selected: selected(2), existing: "replace" }),
    ).toEqual({
      templateId: "d-1",
      allOrganizations: false,
      organizationIds: ["o0", "o1"],
      existing: "replace",
    });
    expect(toCopyRequest("d-1", { ...NO_SHARE, copy: true, allOrganizations: true })).toEqual({
      templateId: "d-1",
      allOrganizations: true,
      existing: "keep",
    });
  });

  it("joins up to three names and counts the rest", () => {
    expect(joinNames(["Acme Corp"], t)).toBe("Acme Corp");
    expect(joinNames(["Acme Corp", "Globex"], t)).toBe("Acme Corp and Globex");
    expect(joinNames(["Acme Corp", "Globex", "Initech"], t)).toBe("Acme Corp, Globex and Initech");
    expect(joinNames(["A", "B", "C", "D", "E"], t)).toBe("A, B, C and 2 more");
  });
});

describe("joinNames takes its separator from the language keys (C14)", () => {
  it("joins with the translated separator, not a built-in one", () => {
    const slash = (key: string, values: Readonly<Record<string, string | number>> = {}) =>
      key === "SHARE_WITH_ORGANIZATIONS.LIST_SEPARATOR" ? " / " : t(key, values);
    expect(joinNames(["A", "B", "C"], slash)).toBe("A / B and C");
    expect(joinNames(["A", "B", "C", "D"], slash)).toBe("A / B / C and 1 more");
  });
});

describe("formatEditedOn uses the app's language (C14)", () => {
  it("formats the month and day for the given language", () => {
    const date = "2026-10-30T09:00:00Z";
    const expected = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
      new Date(date),
    );
    expect(formatEditedOn(date, "en-US")).toBe(expected);
  });

  it("is empty for a missing or unreadable date and survives an unknown language tag", () => {
    expect(formatEditedOn(undefined, "en-US")).toBe("");
    expect(formatEditedOn("not a date", "en-US")).toBe("");
    expect(formatEditedOn("2026-10-30T09:00:00Z", "not a language tag!")).not.toBe("");
  });
});
