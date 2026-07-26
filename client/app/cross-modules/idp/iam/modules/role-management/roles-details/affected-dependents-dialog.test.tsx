import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  changePermissionSelection: vi.fn(),
  permissionMap: new Map<string, unknown>(),
}));

// Provide a selector-compatible store without importing the real zustand module.
vi.mock("./role-details-state", () => ({
  useRoleDetailsStore: (selector: (s: unknown) => unknown) =>
    selector({
      permissionMap: h.permissionMap,
      changePermissionSelection: h.changePermissionSelection,
    }),
}));

import { AffectedPermissionsDialog } from "./affected-dependents-dialog";

const permission = {
  itemId: "child-1",
  resource: "res-child",
  permissionSeverity: 1,
  type: 2,
  parents: ["res-parent"],
} as never;

describe("AffectedPermissionsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.permissionMap = new Map([
      ["res-parent", { itemId: "parent-1", name: "Parent Permission", description: "Parent desc" }],
    ]);
  });

  it("renders the review title and each dependent parent permission", () => {
    render(<AffectedPermissionsDialog permission={permission} open onOpenChange={vi.fn()} />);
    expect(screen.getByText("Review Permission Changes")).toBeTruthy();
    expect(screen.getByText("Parent Permission")).toBeTruthy();
    expect(screen.getByText("Parent desc")).toBeTruthy();
  });

  it("unchecks the permission and closes on Save", () => {
    const onOpenChange = vi.fn();
    render(<AffectedPermissionsDialog permission={permission} open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(h.changePermissionSelection).toHaveBeenCalledWith([
      { permissionResource: "res-child", isChecked: false },
    ]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("falls back to default copy when a parent has no description", () => {
    h.permissionMap = new Map([["res-parent", { itemId: "parent-1", name: "Parent Permission" }]]);
    render(<AffectedPermissionsDialog permission={permission} open onOpenChange={vi.fn()} />);
    expect(screen.getByText("No description available.")).toBeTruthy();
  });
});
