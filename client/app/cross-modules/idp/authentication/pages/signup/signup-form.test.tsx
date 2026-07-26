import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ code: "", reset: vi.fn() }));

vi.mock("@/components/captcha", () => ({ Captcha: () => <div data-testid="captcha" /> }));
vi.mock("@blocks-idp/captcha/hooks/use-captcha", () => ({
  useCaptcha: () => ({ code: h.code, captcha: {}, reset: h.reset }),
}));
vi.mock("@/lib/runtime-env", () => ({ getRuntimeEnv: () => "site-key" }));

import { SignupForm } from "./signup-form";

const renderForm = (emailSignUpEnabled = true) =>
  render(
    <MemoryRouter>
      <SignupForm emailSignUpEnabled={emailSignUpEnabled} />
    </MemoryRouter>,
  );

describe("SignupForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.code = "";
  });

  it("only shows the log-in link when email sign-up is disabled", () => {
    renderForm(false);
    expect(screen.getByText("Log in")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Enter your email")).toBeNull();
  });

  it("renders the email field and a disabled continue button initially", () => {
    renderForm();
    expect(screen.getByPlaceholderText("Enter your email")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("shows the captcha once the email is valid", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByPlaceholderText("Enter your email"), "user@example.com");
    expect(await screen.findByTestId("captcha")).toBeTruthy();
  });

  it("enables continue only with a valid email, captcha code and accepted terms", async () => {
    h.code = "captcha-code";
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByPlaceholderText("Enter your email"), "user@example.com");
    await user.click(screen.getByRole("checkbox"));
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});
