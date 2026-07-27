import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useAddUser: () => ({ isPending: false, mutateAsync: h.mutateAsync }),
}));
vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showSuccessToast: (...a: unknown[]) => h.showSuccessToast(...a),
  showErrorToast: (...a: unknown[]) => h.showErrorToast(...a),
}));

import { InviteUser } from "./invite-user";

const fillAndOpen = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Invite User" }));
  await screen.findByText("Invite a new user to the system");
  await user.type(screen.getByPlaceholderText("Enter first name"), "Ada");
  await user.type(screen.getByPlaceholderText("Enter last name"), "Lovelace");
  await user.type(screen.getByPlaceholderText("Enter email"), "ada@example.com");
};

describe("InviteUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.mutateAsync = vi.fn().mockResolvedValue({ isSuccess: true });
  });

  it("opens the invite dialog and keeps Send disabled until dirty", async () => {
    const user = userEvent.setup();
    render(<InviteUser />);
    await user.click(screen.getByRole("button", { name: "Invite User" }));
    await screen.findByText("Invite a new user to the system");
    expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("sends an invitation with the platform metadata and project key", async () => {
    const user = userEvent.setup();
    render(<InviteUser />);
    await fillAndOpen(user);
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(h.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "ada@example.com",
          firstName: "Ada",
          lastName: "Lovelace",
          userPassType: 1,
          userCreationType: 1,
          platform: "blocks_portal",
          projectKey: "tenant-1",
        }),
      ),
    );
    expect(h.showSuccessToast).toHaveBeenCalledTimes(1);
  });

  it("shows an error toast when the invite is unsuccessful", async () => {
    const user = userEvent.setup();
    h.mutateAsync = vi.fn().mockResolvedValue({ isSuccess: false, errors: "bad" });
    render(<InviteUser />);
    await fillAndOpen(user);
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledTimes(1));
    expect(h.showSuccessToast).not.toHaveBeenCalled();
  });

  it("shows an error toast when the invite throws with field errors", async () => {
    const user = userEvent.setup();
    h.mutateAsync = vi.fn().mockRejectedValue({ errors: { email: "taken" } });
    render(<InviteUser />);
    await fillAndOpen(user);
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledTimes(1));
  });
});
