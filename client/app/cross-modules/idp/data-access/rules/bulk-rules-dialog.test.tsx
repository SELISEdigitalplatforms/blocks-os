import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformSchema } from "../data-access.service";

const h = vi.hoisted(() => ({ bulkValidation: vi.fn(), bulkFieldDefault: vi.fn() }));

vi.mock("@/components/ui-kits/tooltip/tooltip", () => import("@/test-utils/__mocks__/tooltip.mock"));
vi.mock("../gateway/hooks/use-configuration", () => ({
  useSavePlatformValidation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetPlatformFieldDefault: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useBulkPlatformValidation: () => ({ mutateAsync: h.bulkValidation, isPending: false }),
  useBulkPlatformFieldDefault: () => ({ mutateAsync: h.bulkFieldDefault, isPending: false }),
}));
vi.mock("../data-access.service", () => ({ PLATFORM_SERVICES: ["IAM", "OS", "Logic", "Release", "Monitor"] }));

import { BulkRulesDialog } from "./bulk-rules-dialog";

const f = (name: string, over: Partial<PlatformSchema["fields"][number]> = {}) => ({ name, type: "String", isArray: false, editAccessLevel: 0, ...over });
const access = (name: string) => f(name, { type: "OperationAccess", fields: [f("Roles", { isArray: true }), f("UserIds", { isArray: true })] });
const open = (path: string, level: "Allowed" | "Warned" = "Warned") => ({ path, validation: level, default: level, defaultHasNoEffect: false });

const schema = (id: string, schemaName: string, service: PlatformSchema["service"], level: "Normal" | "Warned"): PlatformSchema => ({
  id,
  schemaName,
  collectionName: `${schemaName}s`,
  service,
  readAccessLevel: 0,
  writeAccessLevel: 0,
  editAccessLevel: 0,
  deleteAccessLevel: 0,
  fields: [f("ItemId"), f("Language"), f("Tags", { isArray: true }), f("Name"), access("Read"), access("Update")],
  rules: { level, fields: [open("Language", "Allowed"), open("Tags", "Allowed"), open("Name", "Allowed"), open("Read.Roles"), open("Update.Roles")] },
});

const template = schema("tpl", "EmailTemplate", "OS", "Normal");
const role = schema("role", "Role", "IAM", "Warned");
const build: PlatformSchema = { ...schema("build", "Build", "Release", "Normal"), rules: null };

function renderDialog(schemas: PlatformSchema[] = [template, role, build]) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Dialog open>
        <BulkRulesDialog schemas={schemas} onClose={vi.fn()} />
      </Dialog>
    </QueryClientProvider>,
  );
}

describe("BulkRulesDialog", () => {
  beforeAll(() => {
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.releasePointerCapture ??= () => {};
    Element.prototype.scrollIntoView ??= () => {};
  });

  beforeEach(() => {
    h.bulkValidation.mockReset().mockResolvedValue({ isSuccess: true });
    h.bulkFieldDefault.mockReset().mockResolvedValue({ isSuccess: true });
  });

  it("offers only default properties, and only schemas that take rules", () => {
    renderDialog();

    for (const path of ["Language", "Tags", "Read.Roles", "Update.Roles"]) expect(screen.getByRole("checkbox", { name: path })).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: "Name" })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "ItemId" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Role" })).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: "Build" })).toBeNull();
  });

  it("asks first, then adds the built rules to every picked property of every picked schema", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("checkbox", { name: "Read.Roles" }));
    await user.click(screen.getByRole("checkbox", { name: "Update.Roles" }));
    await user.click(screen.getByRole("button", { name: "Select all" }));

    expect(screen.getByRole("alert").textContent).toContain("Role is used by sign-in and the console");
    await user.click(screen.getByRole("button", { name: "I understand, continue" }));

    await user.click(screen.getByRole("button", { name: /Add validation/ }));
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.click(screen.getByRole("button", { name: "Apply to 4 properties" }));

    await waitFor(() =>
      expect(h.bulkValidation).toHaveBeenCalledWith({
        schemaIds: ["tpl", "role"],
        fieldNames: ["Read.Roles", "Update.Roles"],
        validations: [expect.objectContaining({ type: 0, evaluationVersion: 1 })],
        replace: false,
      }),
    );
    expect(await screen.findByText("Applied to 4 properties")).toBeTruthy();
  });

  it("sets one default on every picked property, and names each refused pair", async () => {
    const user = userEvent.setup();
    h.bulkFieldDefault.mockRejectedValueOnce({ status: 400, errors: { "EmailTemplate.Read.Roles": "Unknown value" } });
    renderDialog([template]);

    await user.click(screen.getByRole("tab", { name: "Default value" }));
    await user.click(screen.getByRole("checkbox", { name: "Read.Roles" }));
    await user.click(screen.getByRole("checkbox", { name: "EmailTemplate" }));
    await user.click(screen.getByRole("button", { name: "I understand, continue" }));
    await user.type(screen.getByRole("textbox", { name: "Value 1" }), "admin");

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("EmailTemplate.Read.Roles: Unknown value")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(h.bulkFieldDefault).toHaveBeenLastCalledWith({
        schemaIds: ["tpl"],
        fieldNames: ["Read.Roles"],
        defaultValue: { kind: "Static", value: ["admin"] },
      }),
    );
  });

  it("won't build one default for a single value and a list together", async () => {
    const user = userEvent.setup();
    renderDialog([template]);

    await user.click(screen.getByRole("tab", { name: "Default value" }));
    await user.click(screen.getByRole("checkbox", { name: "Language" }));
    await user.click(screen.getByRole("checkbox", { name: "Tags" }));
    await user.click(screen.getByRole("checkbox", { name: "EmailTemplate" }));

    expect(screen.getByText(/take different kinds of value/)).toBeTruthy();
  });
});
