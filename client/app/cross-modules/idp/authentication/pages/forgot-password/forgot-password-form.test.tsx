import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  mutateAsync: vi.fn(),
  resetCaptcha: vi.fn(),
  showErrorToast: vi.fn(),
  blocksKey: "pk-1",
}));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => h.navigate };
});
vi.mock("@/lib/runtime-env", () => ({
  getRuntimeEnv: (key: string) => (key === "BLOCKS_X_BLOCKS_KEY" ? h.blocksKey : "site-key"),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (...a: unknown[]) => h.showErrorToast(...a),
}));
vi.mock("@/components/captcha", () => ({ Captcha: () => <div data-testid="captcha" /> }));
vi.mock("@blocks-idp/captcha/hooks/use-captcha", () => ({
  useCaptcha: () => ({ captcha: {}, code: "captcha-code", reset: h.resetCaptcha }),
}));
vi.mock("@blocks-idp/iam/hooks/use-account", () => ({
  useAccountRecover: () => ({ isPending: false, mutateAsync: h.mutateAsync }),
}));

import { ForgotPasswordForm } from "./forgot-password-form";

const renderForm = () =>
  render(
    <MemoryRouter>
      <ForgotPasswordForm />
    </MemoryRouter>,
  );

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.mutateAsync = vi.fn().mockResolvedValue({ isSuccess: true });
    h.blocksKey = "pk-1";
  });

  it("renders the email field and a login link", () => {
    renderForm();
    expect(screen.getByPlaceholderText("Enter your email")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Log in" })).toBeTruthy();
  });

  it("submits the recovery request and navigates on success", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByPlaceholderText("Enter your email"), "user@example.com");
    await waitFor(() => expect(screen.getByTestId("captcha")).toBeTruthy());
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() =>
      expect(h.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "user@example.com",
          captchaCode: "captcha-code",
          projectKey: "pk-1",
        }),
      ),
    );
    expect(h.navigate).toHaveBeenCalledWith("/forgot-email-sent?email=user@example.com");
  });

  it("resets the captcha and shows an error when recovery is unsuccessful", async () => {
    const user = userEvent.setup();
    h.mutateAsync = vi.fn().mockResolvedValue({ isSuccess: false, errors: "bad" });
    renderForm();
    await user.type(screen.getByPlaceholderText("Enter your email"), "user@example.com");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledTimes(1));
    expect(h.resetCaptcha).toHaveBeenCalled();
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it("shows a generic error toast when the request throws", async () => {
    const user = userEvent.setup();
    h.mutateAsync = vi.fn().mockRejectedValue(new Error("network"));
    renderForm();
    await user.type(screen.getByPlaceholderText("Enter your email"), "user@example.com");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "Something went wrong" }),
    );
  });

  it("does nothing when the project key is not configured", async () => {
    const user = userEvent.setup();
    h.blocksKey = "";
    renderForm();
    await user.type(screen.getByPlaceholderText("Enter your email"), "user@example.com");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(screen.getByTestId("captcha")).toBeTruthy());
    expect(h.mutateAsync).not.toHaveBeenCalled();
  });
});
