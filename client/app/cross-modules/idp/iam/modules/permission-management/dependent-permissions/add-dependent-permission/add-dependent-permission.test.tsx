import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  useGetPermissions: vi.fn(),
}));

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/iam/hooks/use-permission", () => ({
  useGetPermissions: (...args: unknown[]) => h.useGetPermissions(...args),
}));

import { AddDependentPermission } from "./add-dependent-permission";

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

describe("AddDependentPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setPermissions(3);
  });

  it("opens the dialog and lists the fetched permissions", async () => {
    const user = userEvent.setup();
    render(<AddDependentPermission permissionsResource={[]} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("Assign Permissions")).toBeTruthy();
    expect(screen.getByText("Permission 1")).toBeTruthy();
    expect(screen.getByText("Permission 3")).toBeTruthy();
  });

  it("reports a checked permission through onChange and reflects the count badge", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AddDependentPermission permissionsResource={[]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.click(await screen.findByLabelText("Select Permission 2"));

    expect(onChange).toHaveBeenLastCalledWith(["resource-2"]);
    expect(screen.getByText("1/5 selected")).toBeTruthy();
  });

  it("unchecks a previously selected permission", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AddDependentPermission permissionsResource={["resource-1"]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Add" }));
    const checkbox = await screen.findByLabelText("Select Permission 1");
    expect((checkbox as HTMLElement).getAttribute("data-state")).toBe("checked");

    await user.click(checkbox);
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("stops accepting selections once the five-permission cap is reached", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    setPermissions(6);
    render(
      <AddDependentPermission
        permissionsResource={["resource-1", "resource-2", "resource-3", "resource-4", "resource-5"]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("5/5 selected")).toBeTruthy();

    await user.click(screen.getByLabelText("Select Permission 6"));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("5/5 selected")).toBeTruthy();
  });

  it("restores the snapshot selection when Cancel is pressed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AddDependentPermission permissionsResource={["resource-1"]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.click(await screen.findByLabelText("Select Permission 2"));
    onChange.mockClear();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onChange).toHaveBeenCalledWith(["resource-1"]);
    await waitFor(() => expect(screen.queryByText("Assign Permissions")).toBeNull());
  });

  it("keeps live selections when Add closes the dialog", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AddDependentPermission permissionsResource={[]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.click(await screen.findByLabelText("Select Permission 1"));
    onChange.mockClear();

    await user.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(screen.queryByText("Assign Permissions")).toBeNull());
    // Add does not revert, so no snapshot restore call is made.
    expect(onChange).not.toHaveBeenCalled();
  });

  it("passes the typed search term into the permissions query", async () => {
    const user = userEvent.setup();
    render(<AddDependentPermission permissionsResource={[]} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.type(await screen.findByPlaceholderText("Search by permission name"), "bill");

    await waitFor(() =>
      expect(h.useGetPermissions).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "bill", projectKey: "tenant-1" }),
      ),
    );
  });
});
