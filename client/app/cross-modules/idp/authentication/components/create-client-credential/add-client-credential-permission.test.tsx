import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  useGetPermissions: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/iam/hooks/use-permission", () => ({
  useGetPermissions: (...args: unknown[]) => h.useGetPermissions(...args),
}));

import { AddClientCredentialPermission } from "./add-client-credential-permission";

const makePermission = (i: number) => ({
  itemId: `perm-${i}`,
  name: `Permission ${i}`,
  resource: `resource-${i}`,
  type: 1,
});

const setPermissions = (count: number, totalCount = count) => {
  h.useGetPermissions.mockReturnValue({
    data: {
      data: Array.from({ length: count }, (_, i) => makePermission(i + 1)),
      totalCount,
    },
    isLoading: false,
  });
};

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Assign Permissions" }));
  return screen.findByRole("heading", { name: "Assign Permissions" });
};

describe("AddClientCredentialPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setPermissions(3);
  });

  it("disables the trigger once the max permission count is already selected", () => {
    render(
      <AddClientCredentialPermission
        selectedResources={["a", "b"]}
        onAdd={vi.fn()}
        maxPermissions={2}
      />,
    );
    expect(
      (screen.getByRole("button", { name: "Assign Permissions" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("adds the pending resources through onAdd", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(
      <AddClientCredentialPermission selectedResources={[]} onAdd={onAdd} maxPermissions={5} />,
    );
    await openDialog(user);

    await user.click(screen.getAllByRole("checkbox")[0]);
    expect(screen.getByText("(1/5)")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(onAdd).toHaveBeenCalledWith(["resource-1"]);
  });

  it("keeps Add disabled until a permission is picked", async () => {
    const user = userEvent.setup();
    render(
      <AddClientCredentialPermission selectedResources={[]} onAdd={vi.fn()} maxPermissions={5} />,
    );
    await openDialog(user);
    expect((screen.getByRole("button", { name: "Add" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("stops adding once the combined selection reaches the max", async () => {
    const user = userEvent.setup();
    setPermissions(6);
    render(
      <AddClientCredentialPermission
        selectedResources={["resource-1"]}
        onAdd={vi.fn()}
        maxPermissions={3}
      />,
    );
    await openDialog(user);

    const checkboxes = screen.getAllByRole("checkbox");
    // resource-1 is disabled (already selected). Pick two fresh to reach the cap of 3.
    await user.click(checkboxes[1]);
    await user.click(checkboxes[2]);
    expect(screen.getByText("(2/3)")).toBeTruthy();

    await user.click(checkboxes[3]);
    expect(screen.getByText("(2/3)")).toBeTruthy();
  });

  it("disables checkboxes for permissions already granted to the credential", async () => {
    const user = userEvent.setup();
    render(
      <AddClientCredentialPermission
        selectedResources={["resource-2"]}
        onAdd={vi.fn()}
        maxPermissions={5}
      />,
    );
    await openDialog(user);
    expect((screen.getAllByRole("checkbox")[1] as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the empty state when no permissions are returned", async () => {
    const user = userEvent.setup();
    setPermissions(0, 0);
    render(
      <AddClientCredentialPermission selectedResources={[]} onAdd={vi.fn()} maxPermissions={5} />,
    );
    await openDialog(user);
    expect(screen.getByText("No permissions found")).toBeTruthy();
  });

  it("passes the search term into the permissions query", async () => {
    const user = userEvent.setup();
    render(
      <AddClientCredentialPermission selectedResources={[]} onAdd={vi.fn()} maxPermissions={5} />,
    );
    await openDialog(user);

    await user.type(screen.getByPlaceholderText("Search by permission name"), "read");
    await waitFor(() =>
      expect(h.useGetPermissions).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "read", projectKey: "tenant-1" }),
        expect.anything(),
      ),
    );
  });
});
