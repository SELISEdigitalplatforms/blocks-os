import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IPermission } from "@blocks-idp/iam/models/permission";

const h = vi.hoisted(() => ({
  useGetPermissions: vi.fn(),
}));

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/iam/hooks/use-permission", () => ({
  useGetPermissions: (...args: unknown[]) => h.useGetPermissions(...args),
}));

import { AddSSOPermission } from "./add-sso-permission";

const makePermission = (i: number) =>
  ({
    itemId: `perm-${i}`,
    name: `Permission ${i}`,
    resource: `resource-${i}`,
    type: 1,
  }) as IPermission;

const setPermissions = (count: number, totalCount = count, isLoading = false) => {
  h.useGetPermissions.mockReturnValue({
    data: {
      data: Array.from({ length: count }, (_, i) => makePermission(i + 1)),
      totalCount,
    },
    isLoading,
  });
};

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Assign Permissions" }));
  return screen.findByRole("heading", { name: "Assign Permissions" });
};

describe("AddSSOPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setPermissions(3);
  });

  it("disables the trigger once five permissions are already assigned", () => {
    const permissions = Array.from({ length: 5 }, (_, i) => makePermission(i + 1));
    render(<AddSSOPermission permissions={permissions} onAdd={vi.fn()} />);
    expect(
      (screen.getByRole("button", { name: "Assign Permissions" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("adds the selected permission objects through onAdd", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<AddSSOPermission permissions={[]} onAdd={onAdd} />);
    await openDialog(user);

    await user.click(screen.getAllByRole("checkbox")[0]);
    expect(screen.getByText("(1/5)")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(onAdd).toHaveBeenCalledWith([expect.objectContaining({ resource: "resource-1" })]);
  });

  it("keeps Add disabled until at least one permission is chosen", async () => {
    const user = userEvent.setup();
    render(<AddSSOPermission permissions={[]} onAdd={vi.fn()} />);
    await openDialog(user);
    expect((screen.getByRole("button", { name: "Add" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("unchecking a permission removes it from the running selection", async () => {
    const user = userEvent.setup();
    render(<AddSSOPermission permissions={[]} onAdd={vi.fn()} />);
    await openDialog(user);

    const first = screen.getAllByRole("checkbox")[0];
    await user.click(first);
    expect(screen.getByText("(1/5)")).toBeTruthy();
    await user.click(first);
    expect(screen.getByText("(0/5)")).toBeTruthy();
  });

  it("disables checkboxes for permissions already granted via props", async () => {
    const user = userEvent.setup();
    render(<AddSSOPermission permissions={[makePermission(2)]} onAdd={vi.fn()} />);
    await openDialog(user);

    const checkboxes = screen.getAllByRole("checkbox");
    expect((checkboxes[1] as HTMLButtonElement).disabled).toBe(true);
  });

  it("stops adding once the combined selection reaches five", async () => {
    const user = userEvent.setup();
    setPermissions(6);
    render(
      <AddSSOPermission
        permissions={[makePermission(1), makePermission(2)]}
        onAdd={vi.fn()}
      />,
    );
    await openDialog(user);

    const checkboxes = screen.getAllByRole("checkbox");
    // resource-1 and resource-2 are disabled; pick the next three to reach five.
    await user.click(checkboxes[2]);
    await user.click(checkboxes[3]);
    await user.click(checkboxes[4]);
    expect(screen.getByText("(3/5)")).toBeTruthy();

    // A fourth new pick is blocked because 2 held + 3 selected already hits five.
    await user.click(checkboxes[5]);
    expect(screen.getByText("(3/5)")).toBeTruthy();
  });

  it("shows the empty state when the query returns no permissions", async () => {
    const user = userEvent.setup();
    setPermissions(0, 0);
    render(<AddSSOPermission permissions={[]} onAdd={vi.fn()} />);
    await openDialog(user);
    expect(screen.getByText("No permissions found")).toBeTruthy();
  });

  it("passes the search term into the permissions query", async () => {
    const user = userEvent.setup();
    render(<AddSSOPermission permissions={[]} onAdd={vi.fn()} />);
    await openDialog(user);

    await user.type(screen.getByPlaceholderText("Search by permission name"), "user");
    await waitFor(() =>
      expect(h.useGetPermissions).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "user", projectKey: "tenant-1" }),
        expect.anything(),
      ),
    );
  });
});
