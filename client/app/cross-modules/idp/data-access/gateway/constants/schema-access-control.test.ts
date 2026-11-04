import { describe, expect, it } from "vitest";
import {
  AUTH_ATTRIBUTE_OPTION,
  AUTH_FIELD_OPTIONS,
  AUTH_LEFT_FIELD_OPTIONS,
  AUTH_STRING_FIELDS,
  FIELD_TYPE_CATEGORY,
  getAuthAttributeName,
  isAuthAttributeField,
} from "./schema-access-control";

describe("access attributes in the rule builder", () => {
  it("offers Attributes on the left side only, as a list of strings", () => {
    expect(AUTH_LEFT_FIELD_OPTIONS).toContain(AUTH_ATTRIBUTE_OPTION);
    expect(AUTH_FIELD_OPTIONS).not.toContain(AUTH_ATTRIBUTE_OPTION);
    expect(AUTH_STRING_FIELDS).not.toContain(AUTH_ATTRIBUTE_OPTION);
    expect(AUTH_ATTRIBUTE_OPTION.category).toBe(FIELD_TYPE_CATEGORY.ARRAY);
  });

  it("recognises the option and its named form", () => {
    expect(isAuthAttributeField("attributes")).toBe(true);
    expect(isAuthAttributeField("attributes.region")).toBe(true);
    expect(isAuthAttributeField("roles")).toBe(false);
    expect(isAuthAttributeField("attributesX")).toBe(false);
    expect(isAuthAttributeField(undefined)).toBe(false);
  });

  it("reads the attribute name, or empty while it is not typed", () => {
    expect(getAuthAttributeName("attributes.region")).toBe("region");
    expect(getAuthAttributeName("attributes.")).toBe("");
    expect(getAuthAttributeName("attributes")).toBe("");
    expect(getAuthAttributeName(undefined)).toBe("");
  });
});
