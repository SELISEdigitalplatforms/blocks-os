import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  captchaCode: "captcha-123",
  resetCaptcha: vi.fn(),
  showErrorToast: vi.fn(),
}));

vi.mock("react-router", () => ({ useNavigate: () => h.navigate }));
vi.mock("@blocks-idp/iam/hooks/use-account", () => ({
  useAccountActivation: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("@blocks-idp/captcha/hooks/use-captcha", () => ({
  useCaptcha: () => ({ captcha: {}, code: h.captchaCode, reset: h.resetCaptcha }),
}));
vi.mock("@/components/captcha", () => ({ Captcha: () => <div data-testid="captcha" /> }));
vi.mock("@/hooks/use-toast", () => ({ showErrorToast: h.showErrorToast }));
vi.mock("../../components/password-strength-checker/password-strength-checker", () => ({
  PasswordStrengthChecker: ({
    onRequirementsMet,
  }: {
    onRequirementsMet: (met: boolean) => void;
  }) => (
    <button type="button" onClick={() => onRequirementsMet(true)}>
      meet-requirements
    </button>
  ),
}));

import { ActivationForm } from "./activation-form";

const fillAndReady = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText("First Name"), "Ada");
  await user.type(screen.getByLabelText("Last Name"), "Lovelace");
  await user.type(screen.getByLabelText("Password"), "Password1!");
  await user.type(screen.getByLabelText("Confirm Password"), "Password1!");
  await user.click(screen.getByRole("button", { name: "meet-requirements" }));
};

describe("ActivationForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.captchaCode = "captcha-123";
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("redirects to login when no activation code is present", () => {
    render(<ActivationForm code="" />);
    expect(h.navigate).toHaveBeenCalledWith("/login");
  });

  it("keeps Activate disabled until the form, captcha and requirements are satisfied", async () => {
    const user = userEvent.setup();
    render(<ActivationForm code="abc" />);

    const activate = screen.getByRole("button", { name: "Activate" }) as HTMLButtonElement;
    expect(activate.disabled).toBe(true);

    await fillAndReady(user);
    await waitFor(() => expect(activate.disabled).toBe(false));
  });

  it("submits the activation payload and navigates to the success screen", async () => {
    const user = userEvent.setup();
    render(<ActivationForm code="activation-code" />);

    await fillAndReady(user);
    await user.click(screen.getByRole("button", { name: "Activate" }));

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    const payload = h.mutateAsync.mock.calls[0][0];
    expect(payload).toMatchObject({
      code: "activation-code",
      firstname: "Ada",
      lastname: "Lovelace",
      password: "Password1!",
      captchaCode: "captcha-123",
      preventPostEvent: true,
    });
    expect(h.navigate).toHaveBeenCalledWith("/activate-success");
  });

  it("resets the captcha and shows the error when activation is unsuccessful", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockResolvedValue({ isSuccess: false, errors: { code: "expired" } });
    render(<ActivationForm code="activation-code" />);

    await fillAndReady(user);
    await user.click(screen.getByRole("button", { name: "Activate" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { code: "expired" } }),
    );
    expect(h.resetCaptcha).toHaveBeenCalled();
    expect(h.navigate).not.toHaveBeenCalledWith("/activate-success");
  });
});
