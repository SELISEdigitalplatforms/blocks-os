import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  data: undefined as unknown,
  isLoading: false,
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/iam/hooks/use-permission", () => ({
  useGetPermissions: () => ({ data: h.data, isLoading: h.isLoading }),
}));

import { AssignSignupPermissionsDialog } from "./assign-signup-permissions-dialog";
import type { IPermission } from "@blocks-idp/iam/models/permission";

const makePerm = (n: number): IPermission =>
  ({ itemId: `p${n}`, name: `Perm ${n}`, resource: `res-${n}`, type: 2 }) as IPermission;

const openDialog = (onAssign = vi.fn(), permissions: IPermission[] = []) => {
  render(<AssignSignupPermissionsDialog permissions={permissions} onAssign={onAssign} />);
  fireEvent.click(screen.getByRole("button", { name: /Manage Permissions/ }));
  return { onAssign };
};

describe("AssignSignupPermissionsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isLoading = false;
    h.data = { data: [makePerm(1), makePerm(2)], totalCount: 2 };
  });

  it("opens the dialog and lists the fetched permissions", () => {
    openDialog();
    expect(screen.getByText("Assign Permissions")).toBeTruthy();
    expect(screen.getByText("Perm 1")).toBeTruthy();
    expect(screen.getByText("Perm 2")).toBeTruthy();
  });

  it("shows the empty state when no permissions are returned", () => {
    h.data = { data: [], totalCount: 0 };
    openDialog();
    expect(screen.getByText("No permissions found")).toBeTruthy();
  });

  it("selects a permission and reflects the running count", () => {
    openDialog();
    expect(screen.getByText(/\(0\/5\)/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Assign permission Perm 1"));
    expect(screen.getByText(/\(1\/5\)/)).toBeTruthy();
  });

  it("hydrates already-assigned permissions when opened", () => {
    openDialog(vi.fn(), [makePerm(1)]);
    expect(screen.getByText(/\(1\/5\)/)).toBeTruthy();
    expect(
      (screen.getByLabelText("Assign permission Perm 1") as HTMLElement).getAttribute("data-state"),
    ).toBe("checked");
  });

  it("enforces the five permission maximum by disabling further checkboxes", () => {
    h.data = {
      data: [makePerm(1), makePerm(2), makePerm(3), makePerm(4), makePerm(5), makePerm(6)],
      totalCount: 6,
    };
    openDialog(vi.fn(), [makePerm(1), makePerm(2), makePerm(3), makePerm(4), makePerm(5)]);
    expect(screen.getByText(/\(5\/5\)/)).toBeTruthy();
    // The sixth, unselected permission cannot be checked at the limit.
    expect(
      (screen.getByLabelText("Assign permission Perm 6") as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("passes the current selection back through onAssign when Set is clicked", () => {
    const { onAssign } = openDialog(vi.fn(), [makePerm(1)]);
    fireEvent.click(screen.getByRole("button", { name: "Set" }));
    expect(onAssign).toHaveBeenCalledWith([expect.objectContaining({ resource: "res-1" })]);
  });
});
