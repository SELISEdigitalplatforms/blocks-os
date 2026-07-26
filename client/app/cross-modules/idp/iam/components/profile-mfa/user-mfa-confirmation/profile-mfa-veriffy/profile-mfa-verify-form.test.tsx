import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  setIsVerifyModalOpen: vi.fn(),
  mfaMethodType: 2,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@blocks-idp/mfa/hooks/use-mfa-config", () => ({
  useVerifyMfaOTP: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (...a: unknown[]) => h.showErrorToast(...a),
  showSuccessToast: (...a: unknown[]) => h.showSuccessToast(...a),
}));
vi.mock("../../profile-mfa", async () => {
  const react = await import("react");
  return {
    profileMfaContext: react.createContext({
      projectKey: "tenant-1",
      userId: "user-1",
      mfaMethodType: h.mfaMethodType,
      setIsVerifyModalOpen: h.setIsVerifyModalOpen,
    }),
  };
});

import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { ProfileMfaVerifyForm } from "./profile-mfa-verify-form";

const renderForm = () =>
  render(
    <Dialog open>
      <ProfileMfaVerifyForm mfaId="mfa-1" />
    </Dialog>,
  );

describe("ProfileMfaVerifyForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.mutateAsync.mockResolvedValue({ isSuccess: true, isValid: true });
  });

  it("renders the OTP inputs and the verify action", () => {
    renderForm();
    expect(screen.getByRole("button", { name: "Verify" })).toBeTruthy();
  });

  it("closes the modal when cancel is clicked", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(h.setIsVerifyModalOpen).toHaveBeenCalledWith(false);
  });

  it("disables the verify button while a verification is pending", () => {
    h.isPending = true;
    renderForm();
    expect((screen.getByRole("button", { name: "Verify" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
