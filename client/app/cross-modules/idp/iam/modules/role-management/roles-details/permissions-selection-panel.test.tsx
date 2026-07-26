import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  permissionMap: new Map<string, unknown>(),
  groupProps: [] as Array<Record<string, unknown>>,
}));

vi.mock("./role-details-state", () => ({
  useRoleDetailsStore: (selector: (s: unknown) => unknown) =>
    selector({ permissionMap: h.permissionMap }),
}));
vi.mock("./permission-group-section", () => ({
  PermissionGroupSection: (props: { group: { name: string }; onTrigger: () => void }) => {
    h.groupProps.push(props);
    return (
      <button data-testid={`group-${props.group.name}`} onClick={props.onTrigger}>
        {props.group.name}
      </button>
    );
  },
}));

import { PermissionsSelectionPanel } from "./permissions-selection-panel";

describe("PermissionsSelectionPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.groupProps = [];
    h.permissionMap = new Map<string, unknown>([
      ["r1", { itemId: "p1", resource: "r1", resourceGroup: "Users" }],
      ["r2", { itemId: "p2", resource: "r2", resourceGroup: "Users" }],
      ["r3", { itemId: "p3", resource: "r3", resourceGroup: "Roles" }],
    ]);
  });

  it("groups permissions by their resource group", () => {
    render(<PermissionsSelectionPanel />);
    expect(screen.getByTestId("group-Users")).toBeTruthy();
    expect(screen.getByTestId("group-Roles")).toBeTruthy();
    const usersGroup = h.groupProps.find(
      (p) => (p.group as { name: string }).name === "Users",
    );
    expect((usersGroup?.group as { permissions: unknown[] }).permissions).toHaveLength(2);
  });

  it("falls back to an Ungrouped bucket when a permission has no group", () => {
    h.permissionMap = new Map<string, unknown>([["r1", { itemId: "p1", resource: "r1" }]]);
    render(<PermissionsSelectionPanel />);
    expect(screen.getByTestId("group-Ungrouped")).toBeTruthy();
  });

  it("keeps rendering group sections after toggling one", () => {
    render(<PermissionsSelectionPanel />);
    fireEvent.click(screen.getByTestId("group-Users"));
    expect(screen.getByTestId("group-Users")).toBeTruthy();
  });
});
