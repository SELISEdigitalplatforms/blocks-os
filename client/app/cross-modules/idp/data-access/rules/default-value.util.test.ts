import { describe, expect, it } from "vitest";
import {
  allowedDefaultKinds,
  canHaveDefault,
  checkDefaultDraft,
  defaultFromDraft,
  draftFromDefault,
  emptyDefaultDraft,
  formatDefaultSummary,
  type DefaultTarget,
} from "./default-value.util";

const target = (fieldType: string, isArray = false, enumValues: string[] = []): DefaultTarget => ({
  fieldType,
  isArray,
  enumValues,
  schemaName: "Employee",
  fields: {
    FirstName: { type: "String", isArray: false, isObject: false },
    LastName: { type: "String", isArray: false, isObject: false },
  },
});

const draft = (kind: "Static" | "Template" | "Now", items: string[], days = "0") => ({
  ...emptyDefaultDraft(kind),
  items,
  offset: { days, hours: "0", minutes: "0", seconds: "0" },
});

describe("which properties and kinds", () => {
  it("locks the platform's own five properties and non-scalar types", () => {
    expect(canHaveDefault("CreatedDate", "DateTime")).toBe(false);
    expect(canHaveDefault("ItemId", "String")).toBe(false);
    expect(canHaveDefault("Tags", "String")).toBe(true);
    expect(canHaveDefault("Location", "GeoJson")).toBe(false);
  });

  it("offers templates on text and Now on a single date-time", () => {
    expect(allowedDefaultKinds("String", false)).toEqual(["Static", "Template"]);
    expect(allowedDefaultKinds("DateTime", false)).toEqual(["Static", "Now"]);
    expect(allowedDefaultKinds("DateTime", true)).toEqual(["Static"]);
    expect(allowedDefaultKinds("Int", false)).toEqual(["Static"]);
  });
});

describe("checks before saving (same messages as the server)", () => {
  it.each([
    ["Int", "abc", '"abc" is not a whole number'],
    ["Float", "x", '"x" is not a number'],
    ["Boolean", "maybe", '"maybe" is not true or false'],
    ["DateTime", "2025-13-01", '"2025-13-01" is not a valid date-time'],
  ])("%s %s", (type, value, expected) => {
    expect(checkDefaultDraft(draft("Static", [value]), target(type))).toBe(expected);
  });

  it("checks enum values and template syntax", () => {
    expect(checkDefaultDraft(draft("Static", ["Gold"]), target("Enum", false, ["Silver", "Bronze"]))).toBe(
      '"Gold" is not one of the listed values (Silver, Bronze)',
    );
    expect(checkDefaultDraft(draft("Template", ["{{Employee.FirstName} {{Employee.LastName}}"]), target("String"))).toBe(
      'Unclosed variable at position 1: expected "}}"',
    );
    expect(checkDefaultDraft(draft("Template", ["{{Employee.FirstName}} {{Employee.LastName}}"]), target("String"))).toBeNull();
  });

  it("checks Now and its offset", () => {
    expect(checkDefaultDraft(draft("Now", [""]), target("String"))).toBe("Now can only be used on single date-time properties");
    expect(checkDefaultDraft(draft("Now", [""], "1.5"), target("DateTime"))).toBe("Days must be a whole number");
    expect(checkDefaultDraft(draft("Now", [""], "-30"), target("DateTime"))).toBeNull();
  });
});

describe("payload and summary", () => {
  it("types static values and keeps lists as lists", () => {
    expect(defaultFromDraft(draft("Static", ["5"]), target("Int"))).toEqual({ kind: "Static", value: 5 });
    expect(defaultFromDraft(draft("Static", ["admin", "", "app-user"]), target("String", true))).toEqual({
      kind: "Static",
      value: ["admin", "app-user"],
    });
    expect(defaultFromDraft(draft("Now", [""], "365"), target("DateTime"))).toEqual({
      kind: "Now",
      value: null,
      offset: { days: 365, hours: 0, minutes: 0, seconds: 0 },
    });
  });

  it("round-trips a saved default into the form", () => {
    const saved = { kind: "Template" as const, value: ["{{Auth.UserId}}"] };
    expect(defaultFromDraft(draftFromDefault(saved), target("String", true))).toEqual(saved);
  });

  it("summarises each kind", () => {
    expect(formatDefaultSummary({ kind: "Now", offset: { days: 365, hours: 0, minutes: 0, seconds: 0 } })).toBe("Now + 365 days");
    expect(formatDefaultSummary({ kind: "Now", offset: { days: -1, hours: 2, minutes: 0, seconds: 0 } })).toBe("Now − 1 day + 2 hours");
    expect(formatDefaultSummary({ kind: "Static", value: ["admin", "app-user"] })).toBe('["admin", "app-user"]');
    expect(formatDefaultSummary({ kind: "Template", value: "{{Employee.FirstName}} {{Employee.LastName}}" })).toBe(
      "{{Employee.FirstName}} {{Employee.LastName}}",
    );
  });
});
