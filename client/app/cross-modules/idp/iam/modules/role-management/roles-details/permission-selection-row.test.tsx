import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  permissionMap: new Map<string, unknown>(),
  changePermissionSelection: vi.fn(),
  toggleProps: undefined as Record<string, unknown> | undefined,
  requiredProps: undefined as Record<string, unknown> | undefined,
  affectedProps: undefined as Record<string, unknown> | undefined,
}));

vi.mock("./role-details-state", () => ({
  useRoleDetailsStore: (selector: (s: unknown) => unknown) =>
    selector({
      permissionMap: h.permissionMap,
      changePermissionSelection: h.changePermissionSelection,
    }),
}));
vi.mock("./permission-toggle-card", () => ({
  PermissionToggleCard: (props: Record<string, unknown>) => {
    h.toggleProps = props;
    return (
      <button
        data-testid="toggle"
        onClick={() => (props.onCheckedChange as (c: boolean) => void)(!(props.checked as boolean))}
      >
        toggle
      </button>
    );
  },
}));
vi.mock("./required-permission-dialog", () => ({
  RequiredPermissionsDialog: (props: Record<string, unknown>) => {
    h.requiredProps = props;
    return <div data-testid="required-dialog">{String(props.open)}</div>;
  },
}));
vi.mock("./affected-dependents-dialog", () => ({
  AffectedPermissionsDialog: (props: Record<string, unknown>) => {
    h.affectedProps = props;
    return <div data-testid="affected-dialog">{String(props.open)}</div>;
  },
}));

import { PermissionSelectionRow } from "./permission-selection-row";
import type { PermissionState } from "./role-details-state";

const basePermission = {
  itemId: "p1",
  resource: "res-1",
  dependentPermissions: [],
  parents: [],
} as unknown as PermissionState;

const mapWith = (assigned: string[]) => {
  const m = new Map<string, unknown>();
  for (const r of assigned) m.set(r, { isInitiallyAssigned: true });
  return m;
};

describe("PermissionSelectionRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.permissionMap = new Map();
  });

  it("toggles a simple permission directly through the store", () => {
    render(<PermissionSelectionRow permission={basePermission} />);
    fireEvent.click(screen.getByTestId("toggle"));
    expect(h.changePermissionSelection).toHaveBeenCalledWith([
      { permissionResource: "res-1", isChecked: true },
    ]);
    expect(screen.getByTestId("required-dialog").textContent).toBe("false");
  });

  it("opens the required-permissions dialog when the permission has dependents", () => {
    render(
      <PermissionSelectionRow
        permission={{ ...basePermission, dependentPermissions: ["dep-1"] } as PermissionState}
      />,
    );
    fireEvent.click(screen.getByTestId("toggle"));
    expect(h.changePermissionSelection).not.toHaveBeenCalled();
    expect(screen.getByTestId("required-dialog").textContent).toBe("true");
  });

  it("opens the affected-dependents dialog when unchecking a permission with assigned parents", () => {
    // The permission is currently checked and has an assigned parent.
    h.permissionMap = mapWith(["res-1", "parent-1"]);
    render(
      <PermissionSelectionRow
        permission={{ ...basePermission, parents: ["parent-1"] } as PermissionState}
      />,
    );
    fireEvent.click(screen.getByTestId("toggle"));
    expect(screen.getByTestId("affected-dialog").textContent).toBe("true");
    expect(h.changePermissionSelection).not.toHaveBeenCalled();
  });
});
