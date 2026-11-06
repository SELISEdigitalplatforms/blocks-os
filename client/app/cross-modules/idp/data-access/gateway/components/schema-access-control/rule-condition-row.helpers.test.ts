import { describe, expect, it } from "vitest";
import {
  FIELD_TYPE_CATEGORY,
  RULE_SOURCE_TYPES,
} from "@blocks-idp/data-access/gateway/constants/schema-access-control";
import { createRuleBuilderHelpers } from "./rule-condition-row";

const helpers = createRuleBuilderHelpers([{ name: "Region", type: "String" }], "Order");

describe("rule builder: Auth > Attributes", () => {
  it("offers Attributes among the left-side Auth fields", () => {
    const values = helpers.getFieldOptions(RULE_SOURCE_TYPES.AUTH).map((option) => option.value);
    expect(values).toContain("attributes");
    expect(values).toContain("roles");
  });

  const rightValues = (category?: (typeof FIELD_TYPE_CATEGORY)[keyof typeof FIELD_TYPE_CATEGORY]) =>
    helpers.getRightFieldOptions(RULE_SOURCE_TYPES.AUTH, category).map((option) => option.value);

  it("offers Attributes on the right for a single value, e.g. DepartmentId IN Auth Attributes", () => {
    expect(rightValues(FIELD_TYPE_CATEGORY.STRING)).toContain("attributes");
    expect(rightValues()).toContain("attributes");
  });

  it("does not offer Attributes on the right for a list or a number", () => {
    expect(rightValues(FIELD_TYPE_CATEGORY.ARRAY)).not.toContain("attributes");
    expect(rightValues(FIELD_TYPE_CATEGORY.NUMERIC)).not.toContain("attributes");
  });

  it("treats a named attribute as a list, like Roles", () => {
    expect(helpers.getLeftFieldCategory(RULE_SOURCE_TYPES.AUTH, "attributes.region")).toBe(
      FIELD_TYPE_CATEGORY.ARRAY,
    );
    expect(helpers.getLeftFieldCategory(RULE_SOURCE_TYPES.AUTH, "attributes")).toBe(
      FIELD_TYPE_CATEGORY.ARRAY,
    );
  });

  it("offers the list operators for it", () => {
    const operators = helpers
      .getFilteredOperators(FIELD_TYPE_CATEGORY.ARRAY, RULE_SOURCE_TYPES.AUTH, "attributes.region")
      .map((operator) => operator.value);
    expect(operators).toContain("CONTAIN");
    expect(operators).not.toContain("EQUAL");
  });

  it("offers no field options for a static value, and a plain Auth field keeps its own category", () => {
    expect(helpers.getFieldOptions(RULE_SOURCE_TYPES.STATIC_VALUE)).toEqual([]);
    expect(helpers.getLeftFieldCategory(RULE_SOURCE_TYPES.AUTH, "userId")).toBe(FIELD_TYPE_CATEGORY.STRING);
  });
});
