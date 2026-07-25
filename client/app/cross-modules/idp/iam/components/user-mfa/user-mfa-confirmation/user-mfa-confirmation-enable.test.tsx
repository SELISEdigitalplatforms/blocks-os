import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  userData: undefined as unknown,
  isLoading: false,
  isFetching: false,
  isPending: false,
  mutateAsync: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
  toast: vi.fn(),
  showTotpModal: vi.fn(),
}));

vi.mock("@blocks-idp/mfa/hooks/use-mfa-config", () => ({
  useConfigureUserMFA: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useGetUserById: () => ({ data: h.userData, isLoading: h.isLoading, isFetching: h.isFetching }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (...a: unknown[]) => h.showErrorToast(...a),
  showSuccessToast: (...a: unknown[]) => h.showSuccessToast(...a),
  toast: (...a: unknown[]) => h.toast(...a),
}));
// Isolate the method picker; drive the selected type through it.
vi.mock("./user-mfa-methods-list", () => ({
  UserMFAMethodList: ({ setSelected }: { setSelected: (n: number) => void }) => (
    <button data-testid="pick-method" onClick={() => setSelected(2)}>
      pick
    </button>
  ),
}));

import { UserMFAConfirmationEnable } from "./user-mfa-confirmation-enable";
import { userMfaContext } from "../user-mfa";

const renderEnable = (enableTotpModal = false) =>
  render(
    <userMfaContext.Provider
      value={{
        projectKey: "tenant-1",
        userId: "user-1",
        enableTotpModal,
        isTotpModalOpen: false,
        setIsTotpModalOpen: vi.fn(),
        showTotpModal: h.showTotpModal,
        mfaMethodType: 0,
      }}
    >
      <UserMFAConfirmationEnable />
    </userMfaContext.Provider>,
  );

describe("UserMFAConfirmationEnable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.userData = { data: { isVerified: true, active: true } };
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("warns to verify the user first when the user is unverified", () => {
    h.userData = { data: { isVerified: false, active: true } };
    renderEnable();
    fireEvent.click(screen.getByRole("button", { name: "Enable" }));
    expect(h.toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Please verify the user first" }),
    );
  });

  it("warns to activate the user first when the user is inactive", () => {
    h.userData = { data: { isVerified: true, active: false } };
    renderEnable();
    fireEvent.click(screen.getByRole("button", { name: "Enable" }));
    expect(h.toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Please active the user first" }),
    );
  });

  it("opens the dialog for a verified active user", () => {
    renderEnable();
    fireEvent.click(screen.getByRole("button", { name: "Enable" }));
    expect(screen.getByText("Enable MFA?")).toBeTruthy();
  });

  it("enables MFA with the chosen method and reports success", async () => {
    renderEnable();
    fireEvent.click(screen.getByRole("button", { name: "Enable" }));
    fireEvent.click(screen.getByTestId("pick-method"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    expect(h.mutateAsync.mock.calls[0][0]).toMatchObject({
      mfaEnabled: true,
      userId: "user-1",
      userMfaType: 2,
    });
    expect(h.showSuccessToast).toHaveBeenCalled();
  });

  it("opens the TOTP modal after enabling when enableTotpModal is set", async () => {
    renderEnable(true);
    fireEvent.click(screen.getByRole("button", { name: "Enable" }));
    fireEvent.click(screen.getByTestId("pick-method"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.showTotpModal).toHaveBeenCalledWith(2));
  });

  it("shows an error toast when enabling fails", async () => {
    h.mutateAsync.mockResolvedValueOnce({ isSuccess: false, errors: { general: "x" } });
    renderEnable();
    fireEvent.click(screen.getByRole("button", { name: "Enable" }));
    fireEvent.click(screen.getByTestId("pick-method"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
  });
});
