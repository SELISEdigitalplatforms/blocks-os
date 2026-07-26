import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false, err: vi.fn(), ok: vi.fn() }));

vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (...a: unknown[]) => h.err(...a),
  showSuccessToast: (...a: unknown[]) => h.ok(...a),
}));
vi.mock("@/lib/error", () => ({
  isErrorWithErrors: (e: unknown) => typeof e === "object" && e !== null && "errors" in e,
}));
vi.mock("@blocks-idp/mfa/hooks/use-mfa-config", () => ({
  useConfigureUserMFA: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("../user-mfa", async () => {
  const { createContext } = await import("react");
  return { userMfaContext: createContext({ projectKey: "pk", userId: "uid" }) };
});

import { UserMFAConfirmationDisable } from "./user-mfa-confirmation-disable";
import { userMfaContext } from "../user-mfa";

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  render(
    <userMfaContext.Provider value={{ projectKey: "pk", userId: "uid" } as never}>
      <UserMFAConfirmationDisable />
    </userMfaContext.Provider>,
  );
  await user.click(screen.getByRole("button", { name: "Disable" }));
  await screen.findByRole("dialog");
};

describe("UserMFAConfirmationDisable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
  });

  it("disables MFA and shows a success toast", async () => {
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
    const user = userEvent.setup();
    await open(user);
    await user.click(screen.getByRole("button", { name: "Yes" }));
    await waitFor(() =>
      expect(h.mutateAsync).toHaveBeenCalledWith({
        mfaEnabled: false,
        projectKey: "pk",
        userId: "uid",
        userMfaType: 0,
      }),
    );
    expect(h.ok).toHaveBeenCalledWith({ description: "MFA disabled successfully" });
  });

  it("shows an error toast when the request reports failure", async () => {
    h.mutateAsync.mockResolvedValue({ isSuccess: false, errors: { general: "bad" } });
    const user = userEvent.setup();
    await open(user);
    await user.click(screen.getByRole("button", { name: "Yes" }));
    await waitFor(() => expect(h.err).toHaveBeenCalledWith({ errors: { general: "bad" } }));
  });

  it("shows an error toast for structured thrown errors", async () => {
    h.mutateAsync.mockRejectedValue({ errors: { field: "x" } });
    const user = userEvent.setup();
    await open(user);
    await user.click(screen.getByRole("button", { name: "Yes" }));
    await waitFor(() => expect(h.err).toHaveBeenCalledWith({ errors: { field: "x" } }));
  });
});
