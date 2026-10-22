import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@blocks-idp/iam/hooks/use-delegation-scope", () => import("@/test-utils/__mocks__/delegation-scope.mock"));
import { mockProjectStoreFactory } from "@/test-utils/__mocks__";
import { delegation, resetDelegation } from "@/test-utils/__mocks__/delegation-scope.mock";
import type { IPolicyItem } from "../../models/data-service";

const h = vi.hoisted(() => ({
  policies: [] as Partial<IPolicyItem>[],
  configure: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => mockProjectStoreFactory());
vi.mock("@/components/ui-kits/tooltip/tooltip", () => import("@/test-utils/__mocks__/tooltip.mock"));
vi.mock("@blocks-idp/data-access/gateway/hooks/use-configuration", () => ({
  useGetPolicyData: () => ({
    data: { isSuccess: true, data: h.policies },
    refetch: vi.fn(),
    isPending: false,
    isFetching: false,
  }),
  useSetRowColumnPermission: () => ({ mutateAsync: h.configure, isPending: false }),
  useCreatePolicy: () => ({ mutateAsync: vi.fn() }),
  useUpdatePolicy: () => ({ mutateAsync: vi.fn() }),
  useDeletePolicy: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { SchemaAccessControlView } from "./schema-access-control-view";

// READ, at schema level by default, currently Signed-in users.
const renderView = ({ level = "row" as "row" | "column", defaultAccessLevel = 1 } = {}) =>
  render(
    <SchemaAccessControlView
      schemaFields={[]}
      schemaName="Role"
      schemaId="role-id"
      level={level}
      operation={0}
      fieldNames={level === "column" ? ["Name"] : []}
      defaultAccessLevel={defaultAccessLevel}
    />,
  );

const tierOptions = () => screen.getAllByRole("radio").map((radio) => radio.getAttribute("aria-label"));

describe("SchemaAccessControlView: who is allowed", () => {
  beforeEach(() => {
    h.policies = [];
  });

  it("offers Signed-in users and Custom on a schema, never Public", () => {
    renderView();
    expect(tierOptions()).toEqual(["Signed-in users", "Custom"]);
  });

  it("adds Inherited on a property", () => {
    renderView({ level: "column", defaultAccessLevel: 0 });
    expect(tierOptions()).toEqual(["Inherited", "Signed-in users", "Custom"]);
  });
});

describe("SchemaAccessControlView: read-only for a caller who is not the system user", () => {
  beforeEach(() => {
    h.policies = [];
    resetDelegation();
  });

  it("switches every control off inside a disabled fieldset, with the reason", () => {
    delegation.systemOnlyReason = "Only the system user can change this.";
    const { container } = renderView();
    expect(container.querySelector("fieldset")?.disabled).toBe(true);
    expect(screen.getByTestId("data-access-read-only").textContent).toContain(
      "Only the system user can change this.",
    );
    for (const radio of screen.getAllByRole("radio")) {
      // `:disabled` also counts the disabled fieldset around the control.
      expect(radio.matches(":disabled")).toBe(true);
    }
    expect(screen.getByRole("button", { name: "Save" }).matches(":disabled")).toBe(true);
  });

  it("changes nothing for the system user", () => {
    const { container } = renderView();
    expect(container.querySelector("fieldset")?.disabled).toBe(false);
    expect(screen.queryByTestId("data-access-read-only")).toBeNull();
  });
});

describe("SchemaAccessControlView: Custom with no rule sets", () => {
  beforeEach(() => {
    h.policies = [];
    h.configure.mockReset().mockResolvedValue({ isSuccess: true });
  });

  it("asks before saving, and saves nothing on Cancel", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("radio", { name: "Custom" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Nobody will be able to read Role");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(h.configure).not.toHaveBeenCalled();
  });

  it("saves the level for this operation once confirmed", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("radio", { name: "Custom" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(await screen.findByRole("button", { name: "Save anyway" }));

    await waitFor(() => expect(h.configure).toHaveBeenCalledTimes(1));
    expect(h.configure).toHaveBeenCalledWith(expect.objectContaining({ schemaId: "role-id", operation: 0, policyType: 0, accessLevel: 3 }));
  });

  it("does not ask when a rule set already exists for this operation", async () => {
    h.policies = [{ itemId: "p1", policyName: "Owner", operation: 0, fieldNames: [], isAllowPolicy: true, ruleGroup: { logicalOperator: 0, rules: [], groups: [] } as never }];
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("radio", { name: "Custom" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.configure).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not ask for any other level", async () => {
    const user = userEvent.setup();
    renderView({ defaultAccessLevel: 3 });

    await user.click(screen.getByRole("radio", { name: "Signed-in users" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.configure).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
