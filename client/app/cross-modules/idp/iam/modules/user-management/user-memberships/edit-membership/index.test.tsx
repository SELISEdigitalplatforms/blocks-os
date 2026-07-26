import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  useGetUserById: vi.fn(),
  useGetRoles: vi.fn(),
  useGetPermissions: vi.fn(),
  updateUser: vi.fn(),
  isPending: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));
vi.mock("@blocks-idp/iam/hooks/use-permission", () => ({
  useGetPermissions: (args: unknown) => h.useGetPermissions(args),
}));
vi.mock("@blocks-idp/iam/hooks/use-roles", () => ({
  useGetRoles: (args: unknown) => h.useGetRoles(args),
}));
vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useGetUserById: (args: unknown) => h.useGetUserById(args),
  useUpdateUser: () => ({ mutateAsync: h.updateUser, isPending: h.isPending }),
}));
vi.mock("../remove-membership", () => ({
  RemoveMembership: ({ open }: { open: boolean }) => (
    <div data-testid="remove-membership" data-open={String(open)} />
  ),
}));

import { EditMembership } from "./index";
import type { IMembership } from "@blocks-idp/iam/models/user";

const roles = [
  { slug: "admin", name: "Administrator" },
  { slug: "viewer", name: "Viewer" },
];

const permissions = [
  { itemId: "p-1", name: "users:read", type: 1, roles: ["admin"] },
  { itemId: "p-2", name: "users:write", type: 1, roles: [] },
];

const membership = {
  roles: ["admin"],
  permissions: ["users:read"],
} as unknown as IMembership;

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  membership,
  organizationName: "Acme Org",
  userId: "user-1",
  projectKey: "proj-1",
};

const renderComponent = (overrides = {}) =>
  render(<EditMembership {...baseProps} {...overrides} />);

describe("EditMembership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.useGetUserById.mockReturnValue({ data: { data: { organizationIds: ["org-1"] } } });
    h.useGetRoles.mockReturnValue({ data: { data: roles }, isLoading: false });
    h.useGetPermissions.mockReturnValue({
      data: { data: permissions, totalCount: 2 },
      isLoading: false,
    });
    h.updateUser.mockResolvedValue({ isSuccess: true });
  });

  it("renders the organization name and the assigned roles in view mode", () => {
    renderComponent();
    expect(screen.getByText("Acme Org")).toBeTruthy();
    expect(screen.getByText("Assigned roles")).toBeTruthy();
    // The assigned slug is displayed by its resolved role name.
    expect(screen.getByText("Administrator")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Unassign User" })).toBeTruthy();
  });

  it("enters edit mode and reveals the role search and save controls", async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByTestId("role-tab-searchbar")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(screen.getByText("Select at least one role to assign")).toBeTruthy();
  });

  it("filters the editable role list by the search input", async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(screen.getByTestId("role-tab-searchbar"), "view");
    await waitFor(() => expect(screen.queryByText("Administrator")).toBeNull());
    expect(screen.getByText("Viewer")).toBeTruthy();
  });

  it("toggles a role and saves the updated membership", async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    // Toggle the Viewer role on.
    const viewerRow = screen.getByText("Viewer").closest("div") as HTMLElement;
    await user.click(within(viewerRow).getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.updateUser).toHaveBeenCalledTimes(1));
    const payload = h.updateUser.mock.calls[0][0];
    expect(payload.roles).toEqual(["admin", "viewer"]);
    expect(payload.permissions).toEqual(["users:read"]);
    expect(payload.organizationIds).toEqual(["org-1"]);
    expect(payload.itemId).toBe("user-1");
    expect(h.showSuccessToast).toHaveBeenCalledWith({
      description: "Membership updated successfully",
    });
  });

  it("surfaces server errors when the save is unsuccessful", async () => {
    h.updateUser.mockResolvedValue({ isSuccess: false, errors: { roles: "required" } });
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { roles: "required" } }),
    );
    expect(h.showSuccessToast).not.toHaveBeenCalled();
  });

  it("shows a generic error toast when the save throws", async () => {
    h.updateUser.mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "Something went wrong" }),
    );
  });

  it("cancelling edit mode returns to the read-only view", async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("opens the remove-membership dialog from the unassign action", async () => {
    const user = userEvent.setup();
    renderComponent();
    expect(screen.getByTestId("remove-membership").getAttribute("data-open")).toBe("false");
    await user.click(screen.getByRole("button", { name: "Unassign User" }));
    await waitFor(() =>
      expect(screen.getByTestId("remove-membership").getAttribute("data-open")).toBe("true"),
    );
  });

  it("switches to the permissions tab and lists the assigned permission", async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole("tab", { name: "Permissions" }));
    expect(await screen.findByText("Assigned Permissions")).toBeTruthy();
    expect(screen.getByText("users:read")).toBeTruthy();
  });
});
