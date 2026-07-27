import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useAddUser: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (...a: unknown[]) => h.showErrorToast(...a),
  showSuccessToast: (...a: unknown[]) => h.showSuccessToast(...a),
}));

import { InviteOrganizationUser } from "./invite-organization-user";

const openDialog = async () => {
  render(<InviteOrganizationUser organizationId="org-9" />);
  fireEvent.click(screen.getByRole("button", { name: "Invite User" }));
  await screen.findByText("Invite a new user to the organization");
};

describe("InviteOrganizationUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("opens the invite dialog from the trigger", async () => {
    await openDialog();
    expect(screen.getByPlaceholderText("Enter first name")).toBeTruthy();
    expect(screen.getByPlaceholderText("Enter email")).toBeTruthy();
  });

  it("blocks submission and shows validation errors on empty fields", async () => {
    const user = userEvent.setup();
    await openDialog();
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("First name is required")).toBeTruthy();
    expect(h.mutateAsync).not.toHaveBeenCalled();
  });

  it("submits the invite with the org id and tenant key then reports success", async () => {
    const user = userEvent.setup();
    await openDialog();
    await user.type(screen.getByPlaceholderText("Enter first name"), "Ada");
    await user.type(screen.getByPlaceholderText("Enter last name"), "Lovelace");
    await user.type(screen.getByPlaceholderText("Enter email"), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    expect(h.mutateAsync.mock.calls[0][0]).toMatchObject({
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      organizationId: "org-9",
      projectKey: "tenant-1",
    });
    expect(h.showSuccessToast).toHaveBeenCalled();
  });

  it("shows an error toast when the invite fails", async () => {
    h.mutateAsync.mockResolvedValueOnce({ isSuccess: false, errors: { general: "dupe" } });
    const user = userEvent.setup();
    await openDialog();
    await user.type(screen.getByPlaceholderText("Enter first name"), "Ada");
    await user.type(screen.getByPlaceholderText("Enter last name"), "L");
    await user.type(screen.getByPlaceholderText("Enter email"), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
  });
});
