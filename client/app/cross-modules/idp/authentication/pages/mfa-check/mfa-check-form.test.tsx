import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  setAuthenticated: vi.fn(),
  resend: vi.fn(),
  remainingTime: 0,
  mfa_id: "mfa-1",
  mfa_type: 2,
}));

vi.mock("react-router", () => ({ useNavigate: () => h.navigate }));
vi.mock("@seliseblocks/genesis-os/store", () => ({
  useAuthStore: () => ({ setAuthenticated: h.setAuthenticated }),
}));
vi.mock("@blocks-idp/mfa/hooks/use-resend-otp", () => ({
  useResendOtp: () => ({ remainingTime: h.remainingTime, resend: h.resend }),
}));
vi.mock("@/hooks/use-toast", () => ({ showErrorToast: vi.fn() }));
vi.mock("nuqs", () => ({
  parseAsString: { withDefault: () => ({}) },
  parseAsInteger: { withDefault: () => ({}) },
  useQueryStates: () => [{ mfa_id: h.mfa_id, mfa_type: h.mfa_type }],
}));

import { MfaCheckFrom } from "./mfa-check-form";

describe("MfaCheckFrom", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.remainingTime = 0;
    h.mfa_type = 2;
  });

  it("renders five OTP slots and the resend action for email MFA (type 2)", () => {
    render(<MfaCheckFrom />);
    // Email type shows a Resend Otp control.
    expect(screen.getByRole("button", { name: /Resend Otp/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Verify" })).toBeTruthy();
  });

  it("keeps Verify disabled until a valid code length is entered", () => {
    render(<MfaCheckFrom />);
    expect((screen.getByRole("button", { name: "Verify" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("triggers a resend when the timer is idle", () => {
    render(<MfaCheckFrom />);
    fireEvent.click(screen.getByRole("button", { name: /Resend Otp/ }));
    expect(h.resend).toHaveBeenCalled();
  });

  it("disables resend and shows a countdown while the timer is running", () => {
    h.remainingTime = 65;
    render(<MfaCheckFrom />);
    const resendBtn = screen.getByRole("button", { name: /Resend Otp/ }) as HTMLButtonElement;
    expect(resendBtn.disabled).toBe(true);
    expect(resendBtn.textContent).toContain("1:05");
  });

  it("hides the resend action for authenticator MFA (type 1)", () => {
    h.mfa_type = 1;
    render(<MfaCheckFrom />);
    expect(screen.queryByRole("button", { name: /Resend Otp/ })).toBeNull();
  });
});
