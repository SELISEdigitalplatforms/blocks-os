import { describe, expect, it } from "vitest";
import {
  addAttributeValue,
  ATTRIBUTE_NAME_PATTERN,
  getOrgAccessAttributes,
  removeAttributeValue,
  sameAccessAttributes,
  withOrgAccessAttributes,
} from "./access-attributes";

describe("access-attributes utils", () => {
  it("reads one organization's attributes, or an empty object", () => {
    const attributes = { access: { org1: { region: ["eu"] } } };
    expect(getOrgAccessAttributes(attributes, "org1")).toEqual({ region: ["eu"] });
    expect(getOrgAccessAttributes(attributes, "org2")).toEqual({});
    expect(getOrgAccessAttributes(undefined, "org1")).toEqual({});
  });

  it("replaces one organization and keeps every other key and organization", () => {
    const attributes = { other: { keep: 1 }, access: { org1: { a: ["1"] }, org2: { b: ["2"] } } };
    const next = withOrgAccessAttributes(attributes, "org1", { a: [" 1 ", "1", ""], empty: [] });
    expect(next).toEqual({
      other: { keep: 1 },
      access: { org1: { a: ["1"] }, org2: { b: ["2"] } },
    });
  });

  it("creates the access key when the user has no attributes yet", () => {
    expect(withOrgAccessAttributes(undefined, "org1", { a: ["x"] })).toEqual({
      access: { org1: { a: ["x"] } },
    });
  });

  it("adds a value once and removes one", () => {
    const added = addAttributeValue({ a: ["x"] }, "a", "y");
    expect(added).toEqual({ a: ["x", "y"] });
    expect(addAttributeValue(added, "a", "y")).toBe(added);
    expect(addAttributeValue({}, "b", "z")).toEqual({ b: ["z"] });
    expect(removeAttributeValue(added, "a", "x")).toEqual({ a: ["y"] });
    expect(removeAttributeValue(added, "missing", "x")).toEqual({ a: ["x", "y"], missing: [] });
  });

  it("compares attributes ignoring order", () => {
    expect(sameAccessAttributes({ a: ["x", "y"] }, { a: ["y", "x"] })).toBe(true);
    expect(sameAccessAttributes({ a: ["x"] }, { a: ["x", "y"] })).toBe(false);
    expect(sameAccessAttributes({ a: ["x"] }, {})).toBe(false);
    expect(sameAccessAttributes({}, { a: ["x"] })).toBe(false);
    expect(sameAccessAttributes({}, {})).toBe(true);
  });

  it("accepts identifier names only", () => {
    expect(ATTRIBUTE_NAME_PATTERN.test("region_2")).toBe(true);
    expect(ATTRIBUTE_NAME_PATTERN.test("2region")).toBe(false);
    expect(ATTRIBUTE_NAME_PATTERN.test("a.b")).toBe(false);
    expect(ATTRIBUTE_NAME_PATTERN.test("")).toBe(false);
  });
});
