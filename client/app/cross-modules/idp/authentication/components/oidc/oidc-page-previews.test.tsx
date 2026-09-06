import type { ComponentType } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { IOidcUiTemplate } from "@blocks-idp/authentication/models/auth.oidc.model";
import { OidcAccountSelectorPreview } from "./oidc-account-selector-preview";
import { OidcActivationPreview } from "./oidc-activation-preview";
import { OidcForgotPasswordPreview } from "./oidc-forgot-password-preview";
import { OidcMfaPreview } from "./oidc-mfa-preview";
import type { OidcPagePreviewProps } from "./oidc-preview-shared";
import { OidcResetPasswordPreview } from "./oidc-reset-password-preview";
import { OidcSignupPreview } from "./oidc-signup-preview";
import { DEFAULT_OIDC_UI_TEMPLATE } from "./oidc-template-defaults";

const cases: Array<{
  label: string;
  Component: ComponentType<OidcPagePreviewProps>;
  copy: () => string[];
  update: (template: IOidcUiTemplate) => void;
}> = [
  {
    label: "Signup",
    Component: OidcSignupPreview,
    copy: () => Object.values(DEFAULT_OIDC_UI_TEMPLATE.pages.signup),
    update: (template) => {
      template.pages.signup.heading = "Join Acme";
    },
  },
  {
    label: "Forgot Password",
    Component: OidcForgotPasswordPreview,
    copy: () => Object.values(DEFAULT_OIDC_UI_TEMPLATE.pages.forgotPassword),
    update: (template) => {
      template.pages.forgotPassword.heading = "Recover Acme access";
    },
  },
  {
    label: "Reset Password",
    Component: OidcResetPasswordPreview,
    copy: () => Object.values(DEFAULT_OIDC_UI_TEMPLATE.pages.resetPassword),
    update: (template) => {
      template.pages.resetPassword.heading = "Choose an Acme password";
    },
  },
  {
    label: "Activation",
    Component: OidcActivationPreview,
    copy: () => Object.values(DEFAULT_OIDC_UI_TEMPLATE.pages.activation),
    update: (template) => {
      template.pages.activation.heading = "Activate Acme";
    },
  },
  {
    label: "MFA",
    Component: OidcMfaPreview,
    copy: () => Object.values(DEFAULT_OIDC_UI_TEMPLATE.pages.mfa).filter(Boolean) as string[],
    update: (template) => {
      template.pages.mfa.submitButton = "Confirm Acme code";
    },
  },
  {
    label: "Account Selector",
    Component: OidcAccountSelectorPreview,
    copy: () =>
      Object.values(DEFAULT_OIDC_UI_TEMPLATE.pages.accountSelector).filter(Boolean) as string[],
    update: (template) => {
      template.pages.accountSelector.heading = "Choose an Acme account";
    },
  },
];

const props = (mode: "light" | "dark"): OidcPagePreviewProps => ({
  template: structuredClone(DEFAULT_OIDC_UI_TEMPLATE),
  palette: DEFAULT_OIDC_UI_TEMPLATE.theme[mode],
  resolvedTheme: mode,
  previewMode: mode,
  onPreviewModeChange: vi.fn(),
  showAuto: true,
});

describe.each(cases)("$label preview", ({ label, Component, copy, update }) => {
  it("renders its default copy and shared footer", () => {
    render(<Component {...props("light")} />);
    const previewText = screen.getByLabelText(`${label} page preview`).textContent;
    for (const value of copy()) expect(previewText).toContain(value);
    expect(screen.getByText(/SELISE Digital Platforms/)).toBeTruthy();
    if (label === "Activation") expect(screen.getByText("First Name")).toBeTruthy();
  });

  it("reflects in-progress copy updates", () => {
    const initial = props("light");
    const { rerender } = render(<Component {...initial} />);
    const updated = structuredClone(initial.template);
    update(updated);
    rerender(<Component {...initial} template={updated} />);
    expect(screen.getByText(/Acme/)).toBeTruthy();
  });

  it.each(["light", "dark"] as const)("maps every required %s color", (mode) => {
    const input = props(mode);
    render(<Component {...input} />);
    const root = screen.getByLabelText(`${label} page preview`);
    const expected = {
      "--bg": input.palette.background,
      "--surface": input.palette.surface,
      "--accent": input.palette.primary,
      "--accent2": input.palette.secondary,
      "--fg": input.palette.text,
      "--muted": input.palette.mutedText,
      "--success": input.palette.success,
      "--danger": input.palette.danger,
      "--border": input.palette.border,
      "--border-strong": input.palette.borderStrong,
      "--accent-soft": input.palette.accentSoft,
    };
    for (const [property, value] of Object.entries(expected)) {
      expect(root.style.getPropertyValue(property)).toBe(value);
    }
  });
});

describe("optional page preview copy", () => {
  it("places signup consent immediately above Create Account", () => {
    render(<OidcSignupPreview {...props("light")} />);
    const createAccount = screen.getByRole("button", { name: "Create Account" });

    expect(createAccount.previousElementSibling?.textContent).toContain("I agree to the");
  });

  it("places logout-from-devices immediately above Set Password", () => {
    render(<OidcResetPasswordPreview {...props("light")} />);
    const setPassword = screen.getByRole("button", { name: "Set Password" });

    expect(setPassword.previousElementSibling?.textContent).toContain("Logout from all devices");
  });

  it("omits a cleared MFA resend action", () => {
    const input = props("light");
    input.template.pages.mfa.resendButton = null;
    render(<OidcMfaPreview {...input} />);
    expect(screen.queryByText("Resend Code")).toBeNull();
  });

  it("omits a cleared account-selector subheading", () => {
    const input = props("light");
    input.template.pages.accountSelector.subheading = null;
    render(<OidcAccountSelectorPreview {...input} />);
    expect(screen.queryByText("Select Account")).toBeNull();
  });
});
