import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  useGetPermissions: vi.fn(),
  addPermissions: vi.fn(),
  resources: [] as string[],
  isPending: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@blocks-idp/iam/hooks/use-permission", () => ({
  useGetPermissions: (...args: unknown[]) => h.useGetPermissions(...args),
}));
vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useUserPermissions: () => ({
    isPending: h.isPending,
    addPermissions: h.addPermissions,
    resources: h.resources,
  }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));

import { AddUserPermission } from "./add-user-permission";

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
  return screen.findByText("Include Permissions");
};

describe("AddUserPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.resources = [];
    h.isPending = false;
    h.addPermissions.mockResolvedValue({ isSuccess: true });
    setPermissions(3);
  });

  it("disables the trigger once the user already has five permissions", () => {
    h.resources = ["a", "b", "c", "d", "e"];
    render(<AddUserPermission userId="u1" projectKey="p1" />);
    expect(
      (screen.getByRole("button", { name: "Assign Permissions" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("includes the selected permissions and reports success", async () => {
    const user = userEvent.setup();
    render(<AddUserPermission userId="u1" projectKey="p1" />);
    await openDialog(user);

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);

    const include = screen.getByRole("button", { name: "Include" }) as HTMLButtonElement;
    expect(include.disabled).toBe(false);
    await user.click(include);

    await waitFor(() => expect(h.addPermissions).toHaveBeenCalledWith(["resource-1"]));
    expect(h.showSuccessToast).toHaveBeenCalledWith({ description: "New permission added" });
  });

  it("uses the plural success message when several permissions are added", async () => {
    const user = userEvent.setup();
    render(<AddUserPermission userId="u1" projectKey="p1" />);
    await openDialog(user);

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole("button", { name: "Include" }));

    await waitFor(() =>
      expect(h.addPermissions).toHaveBeenCalledWith(["resource-1", "resource-2"]),
    );
    expect(h.showSuccessToast).toHaveBeenCalledWith({ description: "New permissions added" });
  });

  it("surfaces a backend error when the include call is not successful", async () => {
    const user = userEvent.setup();
    h.addPermissions.mockResolvedValue({ isSuccess: false, errors: { general: "nope" } });
    render(<AddUserPermission userId="u1" projectKey="p1" />);
    await openDialog(user);

    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: "Include" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { general: "nope" } }),
    );
    expect(h.showSuccessToast).not.toHaveBeenCalled();
  });

  it("falls back to a generic error when the include call throws", async () => {
    const user = userEvent.setup();
    h.addPermissions.mockRejectedValue(new Error("boom"));
    render(<AddUserPermission userId="u1" projectKey="p1" />);
    await openDialog(user);

    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: "Include" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "Something went wrong" }),
    );
  });

  it("disables checkboxes for permissions the user already holds", async () => {
    const user = userEvent.setup();
    h.resources = ["resource-2"];
    render(<AddUserPermission userId="u1" projectKey="p1" />);
    await openDialog(user);

    const checkboxes = screen.getAllByRole("checkbox");
    expect((checkboxes[1] as HTMLButtonElement).disabled).toBe(true);
    expect(checkboxes[1].getAttribute("data-state")).toBe("checked");
  });

  it("blocks selections that would exceed the five-permission ceiling", async () => {
    const user = userEvent.setup();
    h.resources = ["resource-2", "resource-3"];
    setPermissions(6);
    render(<AddUserPermission userId="u1" projectKey="p1" />);
    await openDialog(user);

    const checkboxes = screen.getAllByRole("checkbox");
    // Two already assigned; three fresh picks reach the cap of five.
    await user.click(checkboxes[0]); // resource-1
    await user.click(checkboxes[3]); // resource-4
    await user.click(checkboxes[4]); // resource-5
    // A fourth fresh pick is rejected because 2 held + 3 selected already exceeds 4.
    await user.click(checkboxes[5]); // resource-6
    expect(checkboxes[5].getAttribute("data-state")).toBe("unchecked");
  });

  it("passes the search term into the permissions query", async () => {
    const user = userEvent.setup();
    render(<AddUserPermission userId="u1" projectKey="p1" />);
    await openDialog(user);

    await user.type(screen.getByPlaceholderText("Search by permission name"), "read");
    await waitFor(() =>
      expect(h.useGetPermissions).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "read", projectKey: "p1" }),
      ),
    );
  });
});
