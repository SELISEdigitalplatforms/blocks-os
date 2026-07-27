import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  setIsVerifyModalOpen: vi.fn(),
  isVerifyModalOpen: true,
  mfaMethodType: 1,
}));

vi.mock("@blocks-idp/mfa/hooks/use-mfa-config", () => ({
  useGenerateUserMfaOTP: () => ({ mutateAsync: h.mutateAsync }),
}));
vi.mock("./profile-mfa-verify-form", () => ({
  ProfileMfaVerifyForm: ({ mfaId }: { mfaId: string }) => <div data-testid="verify-form">{mfaId}</div>,
}));
vi.mock("./profile-mfa-verify-guideline-totp", () => ({
  ProfileMfaVerifyGuideLineTotp: () => <div data-testid="totp-guide" />,
}));
vi.mock("./profile-mfa-verify-guideline-email", () => ({
  ProfileMfaVerifyGuideLineEmail: ({ mfaId }: { mfaId: string }) => (
    <div data-testid="email-guide">{mfaId}</div>
  ),
}));
vi.mock("../../profile-mfa", async () => {
  const react = await import("react");
  return {
    profileMfaContext: react.createContext({
      isVerifyModalOpen: h.isVerifyModalOpen,
      setIsVerifyModalOpen: h.setIsVerifyModalOpen,
      mfaMethodType: h.mfaMethodType,
      projectKey: "tenant-1",
      userId: "user-1",
    }),
  };
});

import { ProfileMFAVerify } from "./profile-mfa-verify";

describe("ProfileMFAVerify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.mutateAsync.mockResolvedValue({ isSuccess: true, mfaId: "generated-mfa" });
  });

  it("generates an OTP and shows the TOTP guideline for authenticator MFA", async () => {
    render(<ProfileMFAVerify />);
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    expect(h.mutateAsync.mock.calls[0][0]).toMatchObject({
      projectKey: "tenant-1",
      userId: "user-1",
      mfaType: 1,
    });
    expect(screen.getByTestId("totp-guide")).toBeTruthy();
    expect(screen.getByText("Set up your authenticator app")).toBeTruthy();
    expect(screen.getByTestId("verify-form")).toBeTruthy();
  });
});
