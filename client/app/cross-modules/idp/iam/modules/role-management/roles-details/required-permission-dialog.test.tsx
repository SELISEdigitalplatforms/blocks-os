import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PermissionState } from "./role-details-state";

const h = vi.hoisted(() => ({
  permissionMap: new Map<string, PermissionState>(),
  changePermissionSelection: vi.fn(),
}));

vi.mock("./role-details-state", () => ({
  useRoleDetailsStore: (selector: (state: unknown) => unknown) =>
    selector({
      permissionMap: h.permissionMap,
      changePermissionSelection: h.changePermissionSelection,
    }),
}));

vi.mock("./permission-toggle-card", () => ({
  PermissionToggleCard: ({
    permission,
    checked,
    onCheckedChange,
  }: {
    permission: { resource: string; name: string };
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  }) => (
    <div>
      <span>{permission.name}</span>
      <button
        type="button"
        aria-label={`toggle-${permission.resource}`}
        data-checked={String(checked)}
        onClick={() => onCheckedChange(!checked)}
      >
        toggle
      </button>
    </div>
  ),
}));

import { RequiredPermissionsDialog } from "./required-permission-dialog";

const makeState = (over: Partial<PermissionState> & { resource: string }) =>
  ({
    itemId: over.resource,
    name: over.resource,
    resource: over.resource,
    dependentPermissions: [],
    isInitiallyAssigned: false,
    changeState: null,
    ...over,
  }) as unknown as PermissionState;

const seedMap = () => {
  h.permissionMap = new Map<string, PermissionState>([
    ["users:manage", makeState({ resource: "users:manage", name: "Manage Users", isInitiallyAssigned: true })],
    ["users:read", makeState({ resource: "users:read", name: "Read Users" })],
    ["users:write", makeState({ resource: "users:write", name: "Write Users", isInitiallyAssigned: true })],
  ]);
};

const permission = makeState({
  resource: "users:manage",
  name: "Manage Users",
  isInitiallyAssigned: true,
  dependentPermissions: ["users:read", "users:write"],
});

describe("RequiredPermissionsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedMap();
  });

  it("renders the title, the parent permission and its dependencies", () => {
    render(
      <RequiredPermissionsDialog permission={permission} open onOpenChange={vi.fn()} checked />,
    );

    expect(screen.getByText("Review Permission Changes")).toBeTruthy();
    expect(screen.getByText("Manage Users")).toBeTruthy();
    expect(screen.getByText("Read Users")).toBeTruthy();
    expect(screen.getByText("Write Users")).toBeTruthy();
  });

  it("reflects the initial checked state derived from the permission map", () => {
    render(
      <RequiredPermissionsDialog permission={permission} open onOpenChange={vi.fn()} checked />,
    );
    // users:read is not initially assigned; users:write is.
    expect(screen.getByLabelText("toggle-users:read").getAttribute("data-checked")).toBe("false");
    expect(screen.getByLabelText("toggle-users:write").getAttribute("data-checked")).toBe("true");
  });

  it("collects toggled selections and commits them on Save", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <RequiredPermissionsDialog
        permission={permission}
        open
        onOpenChange={onOpenChange}
        checked
      />,
    );

    await user.click(screen.getByLabelText("toggle-users:read"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(h.changePermissionSelection).toHaveBeenCalledTimes(1);
    const committed = h.changePermissionSelection.mock.calls[0][0];
    expect(committed).toContainEqual({ isChecked: true, permissionResource: "users:read" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("commits an empty change set when nothing is toggled", async () => {
    const user = userEvent.setup();
    render(
      <RequiredPermissionsDialog permission={permission} open onOpenChange={vi.fn()} checked />,
    );

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(h.changePermissionSelection).toHaveBeenCalledWith([]);
  });
});
