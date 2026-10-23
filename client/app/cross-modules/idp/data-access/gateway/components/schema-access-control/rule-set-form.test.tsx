import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mockProjectStoreFactory } from "@/test-utils/__mocks__";
import type { PresetRuleSet } from "@blocks-idp/data-access/gateway/utils/access-presets";
import type { RuleRowValues } from "@blocks-idp/data-access/gateway/utils/schema-access-control.utils";

vi.mock("@seliseblocks/genesis-os", () => mockProjectStoreFactory());

import { RuleSetForm } from "./rule-set-form";

const AUTH = "auth";
const SCHEMA_FIELD = "schema-field";
const STATIC_VALUE = "static-value";
const ATTRIBUTE_NAME = "Attribute name";
const SELECT_FIELDS = "Select fields";
const SET_RIGHT_VALUE = "Set Right value";
const SAVE = "Save rule set";

const row = (overrides: Partial<RuleRowValues>): RuleRowValues => ({
  source: AUTH,
  field: "",
  operator: "",
  compareSource: "",
  compareValue: "",
  ...overrides,
});

const renderForm = (rule: RuleRowValues) => {
  const onStage = vi.fn();
  const seed: PresetRuleSet = { name: "Regional access", logicalOperator: "AND", rules: [rule] };
  render(
    <RuleSetForm
      schemaFields={[{ name: "Region", type: "String" }]}
      schemaName="Order"
      schemaId="order-id"
      operation={0}
      fieldNames={[]}
      level="row"
      seed={seed}
      onStage={onStage}
    />,
  );
  return onStage;
};

const saveButton = () => screen.getByRole("button", { name: SAVE });

const regionEqualsAuth = row({
  source: SCHEMA_FIELD,
  field: "Region",
  operator: "EQUAL",
  compareSource: AUTH,
});

describe("RuleSetForm: left side Auth > Attributes", () => {
  it("blocks Save while the attribute name is not typed", async () => {
    renderForm(row({ field: "attributes", operator: "CONTAIN", compareSource: STATIC_VALUE, compareValue: "eu" }));

    expect(screen.getByRole("button", { name: "Attributes." })).toBeTruthy();
    await waitFor(() => expect(saveButton().matches(":disabled")).toBe(true));
  });

  it("blocks Save for a name that is not an identifier", async () => {
    renderForm(row({ field: "attributes.1-x", operator: "CONTAIN", compareSource: STATIC_VALUE, compareValue: "eu" }));

    expect(screen.getByRole("button", { name: "Attributes.1-x" })).toBeTruthy();
    await waitFor(() => expect(saveButton().matches(":disabled")).toBe(true));
  });

  it("saves a named attribute", async () => {
    const user = userEvent.setup();
    const onStage = renderForm(
      row({ field: "attributes.region_1", operator: "CONTAIN", compareSource: STATIC_VALUE, compareValue: "eu" }),
    );

    expect(screen.getByRole("button", { name: "Attributes.region_1" })).toBeTruthy();
    await waitFor(() => expect(saveButton().matches(":disabled")).toBe(false));
    await user.click(saveButton());

    await waitFor(() => expect(onStage).toHaveBeenCalledTimes(1));
  });

  it("picks Attributes from the left list and keeps the list operators", async () => {
    const user = userEvent.setup();
    renderForm(row({}));

    await user.click(screen.getByRole("button", { name: "Set Left value" }));
    await user.click(await screen.findByText("Attributes"));

    expect(screen.getByRole("button", { name: "Attributes." })).toBeTruthy();
  });
});

describe("RuleSetForm: right side Auth > Attributes", () => {
  it("types the attribute name and strips characters that are not allowed", async () => {
    const user = userEvent.setup();
    renderForm(regionEqualsAuth);

    await user.click(screen.getByRole("button", { name: SET_RIGHT_VALUE }));
    await user.click(await screen.findByText("Attributes"));

    const input = await screen.findByRole("textbox", { name: ATTRIBUTE_NAME });
    expect((input as HTMLInputElement).value).toBe("");
    await waitFor(() => expect(saveButton().matches(":disabled")).toBe(true));

    await user.type(input, "de-pt!");
    expect((input as HTMLInputElement).value).toBe("dept");
    await waitFor(() => expect(saveButton().matches(":disabled")).toBe(false));

    await user.tab();
    expect(await screen.findByRole("button", { name: "Attributes.dept" })).toBeTruthy();
  });

  it("keeps the right value as a field when another Auth field is picked", async () => {
    const user = userEvent.setup();
    renderForm(regionEqualsAuth);

    await user.click(screen.getByRole("button", { name: SET_RIGHT_VALUE }));
    await user.click(await screen.findByText("Email"));

    expect(await screen.findByRole("button", { name: "Email" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: ATTRIBUTE_NAME })).toBeNull();
  });

  it("lets Attributes replace the other fields of an IN rule", async () => {
    const user = userEvent.setup();
    renderForm({ ...regionEqualsAuth, operator: "IN" });

    await user.click(screen.getByRole("button", { name: SET_RIGHT_VALUE }));
    await user.click(await screen.findByRole("button", { name: SELECT_FIELDS }));
    await user.click(await screen.findByText("UserId"));
    expect(await screen.findByRole("button", { name: /userId/ })).toBeTruthy();

    await user.click(await screen.findByText("Attributes"));

    expect(await screen.findByRole("textbox", { name: ATTRIBUTE_NAME })).toBeTruthy();
  });
});
