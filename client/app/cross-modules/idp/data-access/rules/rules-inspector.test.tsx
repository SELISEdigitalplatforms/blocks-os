import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ saveValidation: vi.fn(), setFieldDefault: vi.fn() }));

vi.mock("@/components/ui-kits/tooltip/tooltip", () => import("@/test-utils/__mocks__/tooltip.mock"));
vi.mock("../gateway/hooks/use-configuration", () => ({
  useSavePlatformValidation: () => ({ mutateAsync: h.saveValidation, isPending: false }),
  useSetPlatformFieldDefault: () => ({ mutateAsync: h.setFieldDefault, isPending: false }),
}));
vi.mock("../data-access.service", () => ({
  platformDataAccessService: { getSchemas: () => Promise.resolve({ isSuccess: true, data: [] }) },
}));

import { RulesInspector, type RulesInspectorTarget } from "./rules-inspector";

const target = (over: Partial<RulesInspectorTarget> = {}): RulesInspectorTarget => ({
  panel: "validation",
  schemaId: "tpl-id",
  schemaName: "EmailTemplate",
  service: "OS",
  isWarnedSchema: false,
  path: "TemplateSubject",
  field: { name: "TemplateSubject", type: "String", isArray: false, editAccessLevel: 0 },
  rules: { path: "TemplateSubject", validation: "Allowed", default: "Allowed", defaultHasNoEffect: false },
  variables: {
    schemaName: "EmailTemplate",
    fields: {
      Name: { type: "String", isArray: false, isObject: false },
      TemplateSubject: { type: "String", isArray: false, isObject: false },
    },
  },
  ...over,
});

function renderInspector(value: RulesInspectorTarget) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RulesInspector target={value} onClose={vi.fn()} />
    </QueryClientProvider>,
  );
}

/** userEvent reads "{" and "[" as key descriptors; doubled, they type themselves. */
const literal = (text: string) => text.replaceAll("{", "{{").replaceAll("[", "[[");

describe("RulesInspector", () => {
  beforeAll(() => {
    // Radix Select uses pointer capture, which jsdom does not implement.
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.releasePointerCapture ??= () => {};
    Element.prototype.scrollIntoView ??= () => {};
  });

  beforeEach(() => {
    h.saveValidation.mockReset().mockResolvedValue({ isSuccess: true });
    h.setFieldDefault.mockReset().mockResolvedValue({ isSuccess: true });
  });

  it("adds a rule and saves the property's whole list as version 1", async () => {
    const user = userEvent.setup();
    renderInspector(target());

    await user.click(screen.getByRole("button", { name: /Add validation/ }));
    await user.click(screen.getByRole("combobox", { name: "Rule type" }));
    await user.click(await screen.findByRole("option", { name: "Max length" }));
    await user.type(screen.getByLabelText("Length"), "80");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(h.saveValidation).toHaveBeenCalledWith({
        schemaId: "tpl-id",
        fieldName: "TemplateSubject",
        validations: [expect.objectContaining({ type: 3, value: 80, evaluationVersion: 1 })],
      }),
    );
  });

  it("shows the server's reason when a rule is refused", async () => {
    const user = userEvent.setup();
    h.saveValidation.mockRejectedValue({ status: 400, errors: { TemplateSubject: "Invalid regex pattern" } });
    renderInspector(target());

    await user.click(screen.getByRole("button", { name: /Add validation/ }));
    await user.click(screen.getByRole("combobox", { name: "Rule type" }));
    await user.click(await screen.findByRole("option", { name: "Regex" }));
    await user.type(screen.getByPlaceholderText("e.g. ^[a-zA-Z]+$"), literal("^[a-z"));
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("Invalid regex pattern")).toBeTruthy();
  });

  it("saves a template default using the schema's own name", async () => {
    const user = userEvent.setup();
    renderInspector(target({ panel: "default" }));

    await user.click(screen.getByRole("radio", { name: "Template" }));
    await user.type(screen.getByLabelText("Template"), literal("Welcome to {{EmailTemplate.Name}}"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(h.setFieldDefault).toHaveBeenCalledWith({
        schemaId: "tpl-id",
        fieldName: "TemplateSubject",
        defaultValue: { kind: "Template", value: "Welcome to {{EmailTemplate.Name}}" },
      }),
    );
  });

  it("asks first on a warned property of a normal schema", async () => {
    const user = userEvent.setup();
    renderInspector(
      target({ path: "Read.Roles", rules: { path: "Read.Roles", validation: "Warned", default: "Warned", defaultHasNoEffect: false } }),
    );

    expect(screen.getByRole("alert").textContent).toContain("Read.Roles decides who can see or change EmailTemplate records");
    await user.click(screen.getByRole("button", { name: "I understand, continue" }));
    expect(screen.getByRole("button", { name: /Add validation/ })).toBeTruthy();
  });
});
