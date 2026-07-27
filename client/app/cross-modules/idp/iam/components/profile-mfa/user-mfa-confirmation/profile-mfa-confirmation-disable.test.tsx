import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  err: vi.fn(),
  ok: vi.fn(),
  setOpen: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (...a: unknown[]) => h.err(...a),
  showSuccessToast: (...a: unknown[]) => h.ok(...a),
}));
vi.mock("@/lib/error", () => ({
  isErrorWithErrors: (e: unknown) => typeof e === "object" && e !== null && "errors" in e,
}));
vi.mock("@blocks-idp/mfa/hooks/use-mfa-config", () => ({
  useDisableMfa: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("../profile-mfa", async () => {
  const { createContext } = await import("react");
  return { profileMfaContext: createContext({}) };
});

import { UserMFAConfirmationDisable } from "./profile-mfa-confirmation-disable";
import { profileMfaContext } from "../profile-mfa";

const renderDialog = () =>
  render(
    <profileMfaContext.Provider
      value={
        {
          projectKey: "pk",
          userId: "uid",
          isDisableModalOpen: true,
          setIsDisableModalOpen: h.setOpen,
        } as never
      }
    >
      <UserMFAConfirmationDisable />
    </profileMfaContext.Provider>,
  );

describe("profile UserMFAConfirmationDisable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
  });

  it("disables MFA and shows a success toast", async () => {
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
    renderDialog();
    await userEvent.setup().click(screen.getByRole("button", { name: "Yes" }));
    await waitFor(() =>
      expect(h.mutateAsync).toHaveBeenCalledWith({ projectKey: "pk", userId: "uid" }),
    );
    expect(h.ok).toHaveBeenCalledWith({ description: "MFA disabled successfully" });
    expect(h.setOpen).toHaveBeenCalledWith(false);
  });

  it("shows an error toast when the request reports failure", async () => {
    h.mutateAsync.mockResolvedValue({ isSuccess: false, errors: { general: "bad" } });
    renderDialog();
    await userEvent.setup().click(screen.getByRole("button", { name: "Yes" }));
    await waitFor(() => expect(h.err).toHaveBeenCalledWith({ errors: { general: "bad" } }));
  });

  it("shows an error toast for structured thrown errors", async () => {
    h.mutateAsync.mockRejectedValue({ errors: { field: "x" } });
    renderDialog();
    await userEvent.setup().click(screen.getByRole("button", { name: "Yes" }));
    await waitFor(() => expect(h.err).toHaveBeenCalledWith({ errors: { field: "x" } }));
  });
});
