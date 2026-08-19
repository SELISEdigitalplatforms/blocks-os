import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The tooltip ui-kit re-exports blocks-kit, which touches process.env via
// motion-utils at module load; a passthrough keeps the tree renderable.
vi.mock("@/components/ui-kits/tooltip/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// The edit and toggle modals are heavy standalone components with their own
// tests; render them as Dialog wrappers so the nested DialogTrigger still has
// a Dialog context while the list is isolated from their internals.
vi.mock("../../modals/configure-captcha-modal", async () => {
  const { Dialog } = await import("@/components/ui-kits/dialog/dialog");
  return {
    ConfigureCaptchaModal: ({ children }: { children: React.ReactNode }) => (
      <Dialog>{children}</Dialog>
    ),
  };
});
vi.mock("@blocks-idp/captcha/modals/toggle-captcha-status-modal", async () => {
  const { Dialog } = await import("@/components/ui-kits/dialog/dialog");
  return {
    ToggleCaptchaStatusModal: ({ children }: { children: React.ReactNode }) => (
      <Dialog>{children}</Dialog>
    ),
  };
});

import { ConfigureCaptchaList } from "./configure-captcha-list";

const config = (over: Record<string, unknown> = {}) =>
  ({
    provider: "recaptcha",
    captchaKey: "site-key-value",
    isEnable: true,
    secretId: "sec-1",
    ...over,
  }) as never;

describe("ConfigureCaptchaList", () => {
  it("renders a skeleton while loading", () => {
    const { container } = render(<ConfigureCaptchaList isLoading configuration={null} />);
    expect(container.querySelectorAll(".animate-pulse, [class*='skeleton']").length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText("Captcha is not configured")).toBeNull();
  });

  it("renders the empty state with a configure trigger when nothing is configured", () => {
    render(<ConfigureCaptchaList isLoading={false} configuration={null} />);
    expect(screen.getByText("Captcha is not configured")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Configure Captcha" })).toBeTruthy();
  });

  it("renders the configuration card with the provider label, status, and secret indicator", () => {
    render(<ConfigureCaptchaList isLoading={false} configuration={config()} />);
    expect(screen.getByText("Google reCAPTCHA")).toBeTruthy();
    expect(screen.getByLabelText("Edit")).toBeTruthy();
    expect(screen.getByLabelText("Disable")).toBeTruthy();
    expect(screen.getByText("Site Key")).toBeTruthy();
    expect(screen.getByText("Secret Key")).toBeTruthy();
    expect(screen.getByText("Configured")).toBeTruthy();
  });

  it("shows the enable action for a disabled configuration", () => {
    render(<ConfigureCaptchaList isLoading={false} configuration={config({ isEnable: false })} />);
    expect(screen.getByLabelText("Enable")).toBeTruthy();
  });

  it("shows 'Not set' when the configuration has no linked secret", () => {
    render(<ConfigureCaptchaList isLoading={false} configuration={config({ secretId: null })} />);
    expect(screen.getByText("Not set")).toBeTruthy();
  });

  it("falls back to the empty state for an unknown provider", () => {
    render(<ConfigureCaptchaList isLoading={false} configuration={config({ provider: "mystery" })} />);
    expect(screen.queryByText("Google reCAPTCHA")).toBeNull();
    expect(screen.getByText("Captcha is not configured")).toBeTruthy();
  });
});
