import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  changePermissionGroupSelection: vi.fn(),
  permissionMap: new Map<string, unknown>(),
  isEditMode: true,
}));

vi.mock("./role-details-state", () => ({
  useRoleDetailsStore: (selector: (s: unknown) => unknown) =>
    selector({
      changePermissionGroupSelection: h.changePermissionGroupSelection,
      permissionMap: h.permissionMap,
      isEditMode: h.isEditMode,
    }),
}));
vi.mock("@/components/ui-kits/tooltip/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("./permission-selection-row", () => ({
  PermissionSelectionRow: ({ permission }: { permission: { itemId: string } }) => (
    <li data-testid="perm-row">{permission.itemId}</li>
  ),
}));

import { Accordion } from "@/components/ui-kits/accordion/accordion";
import { PermissionGroupSection } from "./permission-group-section";

const group = {
  name: "Users",
  permissions: [
    { itemId: "p1", resource: "res-1", dependentPermissions: [] },
    { itemId: "p2", resource: "res-2", dependentPermissions: [] },
  ],
} as never;

const mapWith = (assigned: string[]) => {
  const m = new Map<string, unknown>();
  for (const res of assigned) m.set(res, { isInitiallyAssigned: true });
  return m;
};

const renderSection = (onTrigger = vi.fn()) =>
  render(
    <Accordion type="single" collapsible defaultValue="Users">
      <PermissionGroupSection group={group} onTrigger={onTrigger} />
    </Accordion>,
  );

describe("PermissionGroupSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isEditMode = true;
    h.permissionMap = new Map();
  });

  it("renders the group name, total count and its permission rows", () => {
    renderSection();
    expect(screen.getByText("Users")).toBeTruthy();
    expect(screen.getByText("2 total permissions")).toBeTruthy();
    expect(screen.getAllByTestId("perm-row")).toHaveLength(2);
  });

  it("shows the selected count and an unchecked group checkbox when none are assigned", () => {
    renderSection();
    expect(screen.getByText("0 selected")).toBeTruthy();
    expect(screen.getByRole("checkbox").getAttribute("data-state")).toBe("unchecked");
  });

  it("marks the group checkbox checked when all permissions are assigned", () => {
    h.permissionMap = mapWith(["res-1", "res-2"]);
    renderSection();
    expect(screen.getByText("2 selected")).toBeTruthy();
    expect(screen.getByRole("checkbox").getAttribute("data-state")).toBe("checked");
  });

  it("marks the group checkbox indeterminate when only some are assigned", () => {
    h.permissionMap = mapWith(["res-1"]);
    renderSection();
    expect(screen.getByRole("checkbox").getAttribute("data-state")).toBe("indeterminate");
  });

  it("toggles the whole group when the group checkbox is clicked", () => {
    renderSection();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(h.changePermissionGroupSelection).toHaveBeenCalledWith(group.permissions, true);
  });

  it("disables the group checkbox when not in edit mode", () => {
    h.isEditMode = false;
    renderSection();
    expect((screen.getByRole("checkbox") as HTMLButtonElement).disabled).toBe(true);
  });
});
