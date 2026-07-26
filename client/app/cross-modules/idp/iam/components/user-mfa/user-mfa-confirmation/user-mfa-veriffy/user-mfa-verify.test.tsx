import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ mutateAsync: vi.fn(), setOpen: vi.fn() }));

vi.mock("./user-mfa-verify-form", () => ({
  UserMfaVerifyForm: ({ mfaId }: { mfaId: string }) => <div data-testid="verify-form">{mfaId}</div>,
}));
vi.mock("./user-mfa-verify-guideline-totp", () => ({
  UserMfaVerifyGuideLineTotp: () => <div data-testid="totp-guideline" />,
}));
vi.mock("./user-mfa-verify-guideline-email", () => ({
  UserMfaVerifyGuideLineEmail: () => <div data-testid="email-guideline" />,
}));
vi.mock("@blocks-idp/mfa/hooks/use-mfa-config", () => ({
  useGenerateUserMfaOTP: () => ({ mutateAsync: h.mutateAsync }),
}));
vi.mock("../../user-mfa", async () => {
  const { createContext } = await import("react");
  return { userMfaContext: createContext({}) };
});

import { UserMFAVerify } from "./user-mfa-verify";
import { userMfaContext } from "../../user-mfa";

const renderVerify = (mfaMethodType: number, isTotpModalOpen = true) =>
  render(
    <userMfaContext.Provider
      value={
        {
          setIsTotpModalOpen: h.setOpen,
          isTotpModalOpen,
          mfaMethodType,
          projectKey: "pk",
          userId: "uid",
        } as never
      }
    >
      <UserMFAVerify />
    </userMfaContext.Provider>,
  );

describe("UserMFAVerify", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generates an OTP on open and shows the TOTP guideline for authenticator apps", async () => {
    h.mutateAsync.mockResolvedValue({ isSuccess: true, mfaId: "mfa-1" });
    renderVerify(1);
    await waitFor(() =>
      expect(h.mutateAsync).toHaveBeenCalledWith({ projectKey: "pk", userId: "uid", mfaType: 1 }),
    );
    expect(screen.getByText("Set up your authenticator app")).toBeTruthy();
    expect(screen.getByTestId("totp-guideline")).toBeTruthy();
    expect(await screen.findByText("mfa-1")).toBeTruthy();
  });

  it("shows the email guideline for the email method", async () => {
    h.mutateAsync.mockResolvedValue({ isSuccess: true, mfaId: "mfa-2" });
    renderVerify(2);
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    expect(screen.getByTestId("email-guideline")).toBeTruthy();
    expect(screen.queryByText("Set up your authenticator app")).toBeNull();
  });

  it("closes the modal when OTP generation is unsuccessful", async () => {
    h.mutateAsync.mockResolvedValue({ isSuccess: false });
    renderVerify(1);
    await waitFor(() => expect(h.setOpen).toHaveBeenCalledWith(false));
  });

  it("does not generate an OTP while closed", () => {
    renderVerify(1, false);
    expect(h.mutateAsync).not.toHaveBeenCalled();
  });
});
