import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  setIsTotpModalOpen: vi.fn(),
  mfaMethodType: 1,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@blocks-idp/mfa/hooks/use-mfa-config", () => ({
  useVerifyMfaOTP: () => ({ mutateAsync: h.mutateAsync }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (...a: unknown[]) => h.showErrorToast(...a),
  showSuccessToast: (...a: unknown[]) => h.showSuccessToast(...a),
}));
vi.mock("../../user-mfa", async () => {
  const react = await import("react");
  return {
    userMfaContext: react.createContext({
      projectKey: "tenant-1",
      userId: "user-1",
      mfaMethodType: h.mfaMethodType,
      setIsTotpModalOpen: h.setIsTotpModalOpen,
    }),
  };
});

import { UserMfaVerifyForm } from "./user-mfa-verify-form";

describe("UserMfaVerifyForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("renders the verify and cancel actions", () => {
    render(<UserMfaVerifyForm mfaId="mfa-1" />);
    expect(screen.getByRole("button", { name: "Verify" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });

  it("closes the totp modal when cancel is clicked", () => {
    render(<UserMfaVerifyForm mfaId="mfa-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(h.setIsTotpModalOpen).toHaveBeenCalledWith(false);
  });
});
