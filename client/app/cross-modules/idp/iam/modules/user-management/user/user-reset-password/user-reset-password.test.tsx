import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  showSuccessToast: h.showSuccessToast,
  showErrorToast: h.showErrorToast,
}));
vi.mock("@blocks-idp/iam/hooks/use-account", () => ({
  useAdminResetPassword: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));

import { UserResetPassword } from "./user-reset-password";

const renderReset = (setOpen = vi.fn()) =>
  render(<UserResetPassword userId="u1" open setOpen={setOpen} />);

const confirm = () => fireEvent.click(screen.getByRole("button", { name: "Reset" }));

beforeEach(() => {
  vi.clearAllMocks();
  h.isPending = false;
});

describe("UserResetPassword", () => {
  it("renders the confirmation prompt", () => {
    renderReset();
    expect(screen.getByText("Reset password")).toBeTruthy();
  });

  // The public forgot-password flow fails when the project has a captcha; the admin reset sends only the user id.
  it("sends the admin reset by user id only and shows a success toast", async () => {
    const setOpen = vi.fn();
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
    renderReset(setOpen);

    confirm();

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    expect(h.mutateAsync.mock.calls[0][0]).toEqual({ userId: "u1" });
    expect(h.showSuccessToast).toHaveBeenCalled();
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  it("shows the server reason when the reset is refused", async () => {
    const errors = { ResetMail: "A reset mail was sent to this user less than a minute ago. Try again later" };
    h.mutateAsync.mockResolvedValue({ isSuccess: false, errors });
    renderReset();

    confirm();
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledWith({ errors }));
  });

  it("shows the mapped error toast when the call throws with errors", async () => {
    h.mutateAsync.mockRejectedValue({ errors: { UserId: "No user found with this id" } });
    renderReset();

    confirm();
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { UserId: "No user found with this id" } }),
    );
  });
});
