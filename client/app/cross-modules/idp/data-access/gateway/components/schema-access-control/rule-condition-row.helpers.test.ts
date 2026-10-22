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

  it("does not offer Attributes on the right side, where no name can be typed", () => {
    const values = helpers
      .getRightFieldOptions(RULE_SOURCE_TYPES.AUTH, FIELD_TYPE_CATEGORY.STRING)
      .map((option) => option.value);
    expect(values).not.toContain("attributes");
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
});
