import { describe, expect, it } from "vitest";
import {
  MAX_COPY_ORGANIZATIONS,
  NO_SHARE,
  isShareReady,
  joinNames,
  toCopyRequest,
} from "./share-organizations";

// The English values of the list keys, so the joins read as the console shows them.
const t = (key: string, values: Readonly<Record<string, string | number>> = {}) => {
  const text: Record<string, string> = {
    "SHARE_WITH_ORGANIZATIONS.LIST_AND": "{{items}} and {{last}}",
    "SHARE_WITH_ORGANIZATIONS.LIST_MORE": "{{items}} and {{count}} more",
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
