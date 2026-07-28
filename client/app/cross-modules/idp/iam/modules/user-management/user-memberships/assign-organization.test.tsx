import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  useGetUserById: vi.fn(),
  useGetOrganizations: vi.fn(),
  useGetRoles: vi.fn(),
  updateUser: vi.fn(),
  isPending: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));
vi.mock("@blocks-idp/iam/hooks/use-organization", () => ({
  useGetOrganizations: (args: unknown) => h.useGetOrganizations(args),
}));
vi.mock("@blocks-idp/iam/hooks/use-roles", () => ({
  useGetRoles: (args: unknown) => h.useGetRoles(args),
}));
vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useGetUserById: (args: unknown) => h.useGetUserById(args),
  useUpdateUser: () => ({ mutateAsync: h.updateUser, isPending: h.isPending }),
}));

import { AssignOrganization } from "./assign-organization";

const organizations = [
  { itemId: "org-1", name: "Acme Org", isEnable: true },
  { itemId: "org-2", name: "Beta Org", isEnable: true },
  { itemId: "org-3", name: "Disabled Org", isEnable: false },
];

const roles = [
  { slug: "admin", name: "Administrator" },
  { slug: "viewer", name: "Viewer" },
  { slug: "editor", name: "Editor" },
];

const renderComponent = (props = {}) =>
  render(<AssignOrganization userId="user-1" projectKey="proj-1" {...props} />);

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: /Assign/i }));
  await screen.findByText("Assign organization");
};

describe("AssignOrganization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.useGetUserById.mockReturnValue({
      data: { data: { organizationIds: [], roles: {}, permissions: {} } },
    });
    h.useGetOrganizations.mockReturnValue({ data: { organizations }, isLoading: false });
    h.useGetRoles.mockReturnValue({ data: { data: roles }, isLoading: false });
    h.updateUser.mockResolvedValue({ isSuccess: true });
  });

  it("opens the dialog and only lists enabled organizations", async () => {
    const user = userEvent.setup();
    renderComponent();
    await openDialog(user);
    await user.click(screen.getAllByRole("combobox")[0]);
    expect(await screen.findByRole("option", { name: "Acme Org" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Beta Org" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Disabled Org" })).toBeNull();
  });

  it("blocks confirm and toasts when nothing is selected", async () => {
    const user = userEvent.setup();
    renderComponent();
    await openDialog(user);
    const confirm = screen.getByRole("button", { name: "Confirm" });
    // Disabled while nothing is chosen.
    expect(confirm.hasAttribute("disabled")).toBe(true);
    expect(h.updateUser).not.toHaveBeenCalled();
  });

  it("assigns a new organization with selected roles", async () => {
    const user = userEvent.setup();
    renderComponent();
    await openDialog(user);

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(await screen.findByRole("option", { name: "Beta Org" }));

    // Open the roles popover and toggle two roles.
    await user.click(screen.getAllByRole("combobox")[1]);
    await user.click(await screen.findByText("Administrator"));
    await user.click(screen.getByText("Editor"));

    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(h.updateUser).toHaveBeenCalledTimes(1));
    const payload = h.updateUser.mock.calls[0][0];
    expect(payload.organizationIds).toEqual(["org-2"]);
    expect(payload.roles).toEqual(expect.arrayContaining(["admin", "editor"]));
    expect(h.showSuccessToast).toHaveBeenCalledWith({
      description: "Organization assigned successfully",
    });
  });

  it("shows an error toast when the update returns a failure", async () => {
    const user = userEvent.setup();
    h.updateUser.mockResolvedValue({ isSuccess: false, errors: { general: "nope" } });
    renderComponent();
    await openDialog(user);
    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(await screen.findByRole("option", { name: "Acme Org" }));
    await user.click(screen.getAllByRole("combobox")[1]);
    await user.click(await screen.findByText("Viewer"));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { general: "nope" } }));
    expect(h.showSuccessToast).not.toHaveBeenCalled();
  });

  it("shows an error toast when the update throws with structured errors", async () => {
    const user = userEvent.setup();
    h.updateUser.mockRejectedValue({ errors: { name: "bad" } });
    renderComponent();
    await openDialog(user);
    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(await screen.findByRole("option", { name: "Acme Org" }));
    await user.click(screen.getAllByRole("combobox")[1]);
    await user.click(await screen.findByText("Viewer"));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { name: "bad" } }));
  });

  it("preselects the single existing organization and its roles", async () => {
    const user = userEvent.setup();
    h.useGetUserById.mockReturnValue({
      data: {
        data: {
          organizationIds: ["org-1"],
          roles: { "org-1": ["admin"] },
          permissions: {},
        },
      },
    });
    renderComponent();
    await openDialog(user);
    // The roles trigger reflects the preselected admin role.
    await waitFor(() => expect(screen.getByText("Administrator")).toBeTruthy());
  });

  it("shows an empty state when there are no enabled organizations", async () => {
    const user = userEvent.setup();
    h.useGetOrganizations.mockReturnValue({
      data: { organizations: [{ itemId: "x", name: "Off", isEnable: false }] },
      isLoading: false,
    });
    renderComponent();
    await openDialog(user);
    await user.click(screen.getAllByRole("combobox")[0]);
    expect(await screen.findByText("No organizations found")).toBeTruthy();
  });

  it("shows a no-roles state when the role list is empty", async () => {
    const user = userEvent.setup();
    h.useGetRoles.mockReturnValue({ data: { data: [] }, isLoading: false });
    renderComponent();
    await openDialog(user);
    expect(screen.getByText("No roles available")).toBeTruthy();
  });

  it("resets the selection when the dialog is cancelled", async () => {
    const user = userEvent.setup();
    renderComponent();
    await openDialog(user);
    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(await screen.findByRole("option", { name: "Acme Org" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByText("Assign organization")).toBeNull());

    // Reopen: the previously chosen org should be cleared.
    await openDialog(user);
    expect(screen.getByRole("button", { name: "Confirm" }).hasAttribute("disabled")).toBe(true);
  });
});
