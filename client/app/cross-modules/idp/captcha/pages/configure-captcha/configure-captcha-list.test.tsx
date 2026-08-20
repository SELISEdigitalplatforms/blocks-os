import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The tooltip ui-kit re-exports blocks-kit, which touches process.env via
// motion-utils at module load; a passthrough keeps the tree renderable.
vi.mock("@/components/ui-kits/tooltip/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// The edit, toggle, and delete modals are heavy standalone components with
// their own tests; render them as Dialog wrappers so the nested DialogTrigger
// still has a Dialog context while the list is isolated from their internals.
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
vi.mock("@blocks-idp/captcha/modals/delete-captcha-modal", async () => {
  const { Dialog } = await import("@/components/ui-kits/dialog/dialog");
  return {
    DeleteCaptchaModal: ({ children }: { children: React.ReactNode }) => <Dialog>{children}</Dialog>,
  };
});

import { ConfigureCaptchaList } from "./configure-captcha-list";

const config = (over: Record<string, unknown> = {}) =>
  ({
    id: "cfg-1",
    provider: "recaptcha",
    captchaKey: "site-key-value",
    isEnable: true,
    secretId: "sec-1",
    ...over,
  }) as never;

describe("ConfigureCaptchaList", () => {
  it("renders a skeleton while loading", () => {
    const { container } = render(<ConfigureCaptchaList isLoading configurations={[]} />);
    expect(container.querySelectorAll(".animate-pulse, [class*='skeleton']").length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText("Captcha is not configured")).toBeNull();
  });

  it("renders the empty state when nothing is configured, relying on the page header's Add Configuration action", () => {
    render(<ConfigureCaptchaList isLoading={false} configurations={[]} />);
    expect(screen.getByText("Captcha is not configured")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Configure Captcha" })).toBeNull();
  });

  it("renders a configuration card with the provider label, status, and secret indicator", () => {
    render(<ConfigureCaptchaList isLoading={false} configurations={[config()]} />);
    expect(screen.getByText("Google reCAPTCHA")).toBeTruthy();
    expect(screen.getByLabelText("Edit")).toBeTruthy();
    expect(screen.getByLabelText("Disable")).toBeTruthy();
    expect(screen.getByLabelText("Delete")).toBeTruthy();
    expect(screen.getByText("Site Key")).toBeTruthy();
    expect(screen.getByText("Secret Key")).toBeTruthy();
    expect(screen.getByText("Configured")).toBeTruthy();
  });

  it("shows the enable action for a disabled configuration", () => {
    render(
      <ConfigureCaptchaList isLoading={false} configurations={[config({ isEnable: false })]} />,
    );
    expect(screen.getByLabelText("Enable")).toBeTruthy();
  });

  it("shows 'Not set' when the configuration has no linked secret", () => {
    render(
      <ConfigureCaptchaList isLoading={false} configurations={[config({ secretId: null })]} />,
    );
    expect(screen.getByText("Not set")).toBeTruthy();
  });

  it("skips an unknown-provider configuration without dropping the rest of the list", () => {
    render(
      <ConfigureCaptchaList
        isLoading={false}
        configurations={[config({ id: "cfg-mystery", provider: "mystery" }), config()]}
      />,
    );
    expect(screen.queryByText("mystery")).toBeNull();
    expect(screen.getByText("Google reCAPTCHA")).toBeTruthy();
  });

  it("renders one card per configuration", () => {
    render(
      <ConfigureCaptchaList
        isLoading={false}
        configurations={[
          config({ id: "cfg-1", provider: "recaptcha" }),
          config({ id: "cfg-2", provider: "hcaptcha", isEnable: false }),
        ]}
      />,
    );
    expect(screen.getByText("Google reCAPTCHA")).toBeTruthy();
    expect(screen.getByText("hCAPTCHA")).toBeTruthy();
    expect(screen.getAllByLabelText("Edit")).toHaveLength(2);
    expect(screen.getAllByLabelText("Delete")).toHaveLength(2);
  });
});
