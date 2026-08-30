import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));

const h = vi.hoisted(() => ({
  createUser: vi.fn(),
  updateUserAccess: vi.fn(),
  checkExists: { data: undefined as unknown, isFetching: false },
  orgs: { data: { organizations: [] as unknown[] }, isLoading: false },
  // Multi-org OFF keeps the org picker hidden, so the happy path is just
  // email + first name + last name.
  config: { data: { isMultiOrgEnabled: false }, isLoading: false },
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useAddUser: () => ({ isPending: false, mutateAsync: h.createUser }),
  useCheckUserExists: () => h.checkExists,
  useUpdateUserAccessControl: () => ({ mutateAsync: h.updateUserAccess, isPending: false }),
}));
vi.mock("@blocks-idp/iam/hooks/use-organization", () => ({
  useGetOrganizations: () => h.orgs,
  useGetOrganizationConfig: () => h.config,
}));
vi.mock("@/store/useProjectStore", () => ({
  useProjectStore: vi.fn(() => ({
    selectedProject: { tenantId: "t1", itemId: "p1" },
    selectedTenantGroup: "tg1",
  })),
}));
vi.mock("@/hooks/use-toast", () => ({
  showSuccessToast: h.showSuccessToast,
  showErrorToast: h.showErrorToast,
}));

import { InviteUser } from "./invite-user";

const renderInvite = () => render(<InviteUser />, { wrapper: createWrapper() });

beforeEach(() => {
  vi.clearAllMocks();
  h.checkExists = { data: undefined, isFetching: false };
  h.orgs = { data: { organizations: [] as unknown[] }, isLoading: false };
  h.config = { data: { isMultiOrgEnabled: false }, isLoading: false };
});

describe("InviteUser", () => {
  it("renders the trigger button", () => {
    renderInvite();
    expect(screen.getByRole("button", { name: /invite user/i })).toBeTruthy();
  });

  it("opens the dialog with the email field", async () => {
    const user = userEvent.setup();
    renderInvite();
    await user.click(screen.getByRole("button", { name: /invite user/i }));
    expect(await screen.findByText("Add a user to an organization.")).toBeTruthy();
    expect(screen.getByPlaceholderText("name@company.com")).toBeTruthy();
  });

  it("does not collect the name, it is provided by the user at activation", async () => {
    const user = userEvent.setup();
    renderInvite();
    await user.click(screen.getByRole("button", { name: /invite user/i }));
    await user.type(screen.getByPlaceholderText("name@company.com"), "new@user.com");
    // The send button becomes enabled from the email alone, and no name inputs appear.
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: /send invite/i }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    expect(screen.queryByPlaceholderText("Enter first name")).toBeNull();
    expect(screen.queryByPlaceholderText("Enter last name")).toBeNull();
  });

  it("creates a new user with empty names and shows a success toast", async () => {
    h.createUser.mockResolvedValue({ isSuccess: true });
    const user = userEvent.setup();
    renderInvite();
    await user.click(screen.getByRole("button", { name: /invite user/i }));
    await user.type(screen.getByPlaceholderText("name@company.com"), "new@user.com");

    const submit = screen.getByRole("button", { name: /send invite/i });
    await waitFor(() => expect((submit as HTMLButtonElement).disabled).toBe(false));
    await user.click(submit);

    await waitFor(() => expect(h.createUser).toHaveBeenCalled());
    const payload = h.createUser.mock.calls[0][0];
    expect(payload).toMatchObject({
      email: "new@user.com",
      firstName: "",
      lastName: "",
      userPassType: 1,
      userCreationType: 1,
      platform: "blocks_portal",
    });
    expect(payload).not.toHaveProperty("organizationIds");
    expect(h.showSuccessToast).toHaveBeenCalledWith({ description: "Invitation is sent" });
  });

  it("creates a new user with organizationId when multi-org is enabled", async () => {
    h.config = { data: { isMultiOrgEnabled: true }, isLoading: false };
    h.orgs = {
      data: { organizations: [{ itemId: "org-1", name: "Acme Org", isDisabled: false }] },
      isLoading: false,
    };
    h.createUser.mockResolvedValue({ isSuccess: true });
    const user = userEvent.setup();
    renderInvite();
    await user.click(screen.getByRole("button", { name: /invite user/i }));
    await user.type(screen.getByPlaceholderText("name@company.com"), "new@user.com");

    await user.click(await screen.findByRole("combobox"));
    await user.click(await screen.findByText("Acme Org"));

    const submit = screen.getByRole("button", { name: /send invite/i });
    await waitFor(() => expect((submit as HTMLButtonElement).disabled).toBe(false));
    await user.click(submit);

    await waitFor(() => expect(h.createUser).toHaveBeenCalled());
    const payload = h.createUser.mock.calls[0][0];
    expect(payload).toMatchObject({
      email: "new@user.com",
      organizationId: "org-1",
    });
    expect(payload).not.toHaveProperty("organizationIds");
  });

  const fillNewUser = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: /invite user/i }));
    await user.type(screen.getByPlaceholderText("name@company.com"), "new@user.com");
  };

  it("shows an error toast when user creation is unsuccessful", async () => {
    h.createUser.mockResolvedValue({ isSuccess: false, errors: { email: "already invited" } });
    const user = userEvent.setup();
    renderInvite();
    await fillNewUser(user);

    const submit = screen.getByRole("button", { name: /send invite/i });
    await waitFor(() => expect((submit as HTMLButtonElement).disabled).toBe(false));
    await user.click(submit);

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "already invited" }),
    );
    expect(h.showSuccessToast).not.toHaveBeenCalled();
  });

  it("shows the mapped error toast when creation throws with errors", async () => {
    h.createUser.mockRejectedValue({ errors: { email: "boom" } });
    const user = userEvent.setup();
    renderInvite();
    await fillNewUser(user);

    const submit = screen.getByRole("button", { name: /send invite/i });
    await waitFor(() => expect((submit as HTMLButtonElement).disabled).toBe(false));
    await user.click(submit);

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { email: "boom" } }),
    );
  });

  it("shows a generic error toast when creation throws a plain error", async () => {
    h.createUser.mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    renderInvite();
    await fillNewUser(user);

    const submit = screen.getByRole("button", { name: /send invite/i });
    await waitFor(() => expect((submit as HTMLButtonElement).disabled).toBe(false));
    await user.click(submit);

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "Something went wrong" }),
    );
  });

  it("warns and blocks submit when an existing user is found with multi-org disabled", async () => {
    h.checkExists = { data: { userId: "u1", organizationIds: [] }, isFetching: false };
    const user = userEvent.setup();
    renderInvite();
    await user.click(screen.getByRole("button", { name: /invite user/i }));
    await user.type(screen.getByPlaceholderText("name@company.com"), "existing@user.com");

    expect(
      await screen.findByText("A user with this email already exists in the system."),
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /grant access/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("grants an existing user access to a selected organization", async () => {
    h.config = { data: { isMultiOrgEnabled: true }, isLoading: false };
    h.orgs = {
      data: { organizations: [{ itemId: "org-1", name: "Acme Org", isDisabled: false }] },
      isLoading: false,
    };
    h.checkExists = { data: { userId: "u1", organizationIds: [] }, isFetching: false };
    h.updateUserAccess.mockResolvedValue({ isSuccess: true });
    const user = userEvent.setup();
    renderInvite();
    await user.click(screen.getByRole("button", { name: /invite user/i }));
    await user.type(screen.getByPlaceholderText("name@company.com"), "existing@user.com");

    await user.click(await screen.findByRole("combobox"));
    await user.click(await screen.findByText("Acme Org"));

    const submit = screen.getByRole("button", { name: /grant access/i });
    await waitFor(() => expect((submit as HTMLButtonElement).disabled).toBe(false));
    await user.click(submit);

    await waitFor(() => expect(h.updateUserAccess).toHaveBeenCalled());
    expect(h.updateUserAccess.mock.calls[0][0]).toMatchObject({ organizationId: "org-1" });
    expect(h.showSuccessToast).toHaveBeenCalledWith({
      description: "User granted access to the organization",
    });
  });

  it("shows an error toast when granting access is unsuccessful", async () => {
    h.config = { data: { isMultiOrgEnabled: true }, isLoading: false };
    h.orgs = {
      data: { organizations: [{ itemId: "org-1", name: "Acme Org", isDisabled: false }] },
      isLoading: false,
    };
    h.checkExists = { data: { userId: "u1", organizationIds: [] }, isFetching: false };
    h.updateUserAccess.mockResolvedValue({ isSuccess: false, errors: { org: "denied" } });
    const user = userEvent.setup();
    renderInvite();
    await user.click(screen.getByRole("button", { name: /invite user/i }));
    await user.type(screen.getByPlaceholderText("name@company.com"), "existing@user.com");

    await user.click(await screen.findByRole("combobox"));
    await user.click(await screen.findByText("Acme Org"));

    const submit = screen.getByRole("button", { name: /grant access/i });
    await waitFor(() => expect((submit as HTMLButtonElement).disabled).toBe(false));
    await user.click(submit);

    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "denied" }));
  });

  it("checks the typed email once the debounce settles and flags a known account", async () => {
    h.checkExists = { data: { userId: "u1", organizationIds: [] }, isFetching: false };
    const user = userEvent.setup();
    renderInvite();
    await user.click(screen.getByRole("button", { name: /invite user/i }));
    await user.type(screen.getByPlaceholderText("name@company.com"), "existing@user.com");

    // The "already exists" tick only appears once the 400ms debounce has
    // elapsed and the existence check is no longer considered in flight.
    await waitFor(() => expect(document.body.querySelector(".text-green-600")).not.toBeNull(), {
      timeout: 2000,
    });
    expect(document.body.querySelector(".animate-spin")).toBeNull();
  });

  it("does not preselect an organization while the org list is still loading", async () => {
    h.config = { data: { isMultiOrgEnabled: true }, isLoading: false };
    h.orgs = { data: undefined as unknown as { organizations: unknown[] }, isLoading: true };
    const user = userEvent.setup();
    renderInvite();
    await user.click(screen.getByRole("button", { name: /invite user/i }));
    await user.type(screen.getByPlaceholderText("name@company.com"), "new@user.com");

    const combobox = await screen.findByRole("combobox");
    expect(combobox.textContent).toContain("Select organization");
    await user.click(combobox);
    expect(await screen.findByText("Loading organizations...")).toBeTruthy();
  });

  it("seeds the synthetic Default organization when the workspace has no real ones", async () => {
    h.config = { data: { isMultiOrgEnabled: true }, isLoading: false };
    h.orgs = { data: { organizations: [] }, isLoading: false };
    h.createUser.mockResolvedValue({ isSuccess: true });
    const user = userEvent.setup();
    renderInvite();
    await user.click(screen.getByRole("button", { name: /invite user/i }));
    await user.type(screen.getByPlaceholderText("name@company.com"), "new@user.com");

    const combobox = await screen.findByRole("combobox");
    await waitFor(() => expect(combobox.textContent).toContain("Default"));

    const submit = screen.getByRole("button", { name: /send invite/i });
    await waitFor(() => expect((submit as HTMLButtonElement).disabled).toBe(false));
    await user.click(submit);
    await waitFor(() => expect(h.createUser).toHaveBeenCalled());
    expect(h.createUser.mock.calls[0][0]).toMatchObject({ organizationId: "default" });
  });

  it("shows Default as preselected when the existing user already belongs to it", async () => {
    h.config = { data: { isMultiOrgEnabled: true }, isLoading: false };
    h.orgs = { data: { organizations: [] }, isLoading: false };
    h.checkExists = { data: { userId: "u1", organizationIds: ["default"] }, isFetching: false };
    const user = userEvent.setup();
    renderInvite();
    await user.click(screen.getByRole("button", { name: /invite user/i }));
    await user.type(screen.getByPlaceholderText("name@company.com"), "existing@user.com");

    const combobox = await screen.findByRole("combobox");
    await waitFor(() => expect(combobox.textContent).toContain("Default"));
    expect(
      (screen.getByRole("button", { name: /grant access/i }) as HTMLButtonElement).disabled,
    ).toBe(true);

    await user.click(combobox);
    const defaultOption = await screen.findByRole("option", { name: "Default" });
    expect(defaultOption.getAttribute("aria-selected")).toBe("true");
    expect(defaultOption.getAttribute("aria-disabled")).toBe("true");
    expect(defaultOption.querySelector(".text-green-600")).not.toBeNull();
  });

  it("keeps Default visible with a green tick when the existing user belongs to it", async () => {
    h.config = { data: { isMultiOrgEnabled: true }, isLoading: false };
    h.orgs = {
      data: { organizations: [{ itemId: "org-1", name: "Acme Org", isDisabled: false }] },
      isLoading: false,
    };
    h.checkExists = { data: { userId: "u1", organizationIds: ["default"] }, isFetching: false };
    const user = userEvent.setup();
    renderInvite();
    await user.click(screen.getByRole("button", { name: /invite user/i }));
    await user.type(screen.getByPlaceholderText("name@company.com"), "existing@user.com");

    await user.click(await screen.findByRole("combobox"));
    expect(await screen.findByText("Acme Org")).toBeTruthy();
    const defaultOption = await screen.findByRole("option", { name: "Default" });
    expect(defaultOption.getAttribute("aria-selected")).toBe("true");
    expect(defaultOption.querySelector(".text-green-600")).not.toBeNull();
  });

  it("keeps and marks an organization the existing user turns out to belong to", async () => {
    h.config = { data: { isMultiOrgEnabled: true }, isLoading: false };
    h.orgs = {
      data: { organizations: [{ itemId: "org-1", name: "Acme Org", isDisabled: false }] },
      isLoading: false,
    };
    const user = userEvent.setup();
    renderInvite();
    await user.click(screen.getByRole("button", { name: /invite user/i }));
    const email = screen.getByPlaceholderText("name@company.com");
    await user.type(email, "member@user.com");

    const combobox = await screen.findByRole("combobox");
    await user.click(combobox);
    await user.click(await screen.findByText("Acme Org"));
    await waitFor(() => expect(combobox.textContent).toContain("Acme Org"));

    // The existence check now reports this address as an existing member of the
    // selected organization, so it stays visible and is marked as already assigned.
    h.checkExists = { data: { userId: "u1", organizationIds: ["org-1"] }, isFetching: false };
    await user.type(email, "s");

    await waitFor(() => expect(combobox.textContent).toContain("Acme Org"));
    expect(
      (screen.getByRole("button", { name: /grant access/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await user.click(combobox);
    const existingOption = await screen.findByRole("option", { name: "Acme Org" });
    expect(existingOption.getAttribute("aria-selected")).toBe("true");
    expect(existingOption.querySelector(".text-green-600")).not.toBeNull();
  });

  it("skips organizations that are explicitly disabled", async () => {
    h.config = { data: { isMultiOrgEnabled: true }, isLoading: false };
    h.orgs = {
      data: {
        organizations: [
          { itemId: "org-1", name: "Acme Org", isDisabled: false },
          { itemId: "org-2", name: "Retired Org", isDisabled: true },
        ],
      },
      isLoading: false,
    };
    const user = userEvent.setup();
    renderInvite();
    await user.click(screen.getByRole("button", { name: /invite user/i }));
    await user.type(screen.getByPlaceholderText("name@company.com"), "new@user.com");

    await user.click(await screen.findByRole("combobox"));
    expect(await screen.findByText("Acme Org")).toBeTruthy();
    expect(screen.queryByText("Retired Org")).toBeNull();
  });

  it("closes the dialog from the Cancel button", async () => {
    const user = userEvent.setup();
    renderInvite();
    await user.click(screen.getByRole("button", { name: /invite user/i }));
    await screen.findByText("Add a user to an organization.");

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByText("Add a user to an organization.")).toBeNull());
  });
});
