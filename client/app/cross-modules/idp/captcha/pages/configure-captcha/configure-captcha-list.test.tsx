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
    itemId: "c1",
    provider: "recaptcha",
    captchaKey: "site-key-value",
    captchaSecret: "secret-key-value",
    isEnable: true,
    ...over,
  }) as never;

describe("ConfigureCaptchaList", () => {
  it("renders skeletons while loading", () => {
    const { container } = render(<ConfigureCaptchaList isLoading configurations={[]} />);
    expect(container.querySelectorAll(".animate-pulse, [class*='skeleton']").length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText("No configurations found")).toBeNull();
  });

  it("renders the empty state when there are no configurations", () => {
    render(<ConfigureCaptchaList isLoading={false} configurations={[]} />);
    expect(screen.getByText("No configurations found")).toBeTruthy();
  });

  it("renders a card per configuration with the provider label and actions", () => {
    render(<ConfigureCaptchaList isLoading={false} configurations={[config()]} />);
    expect(screen.getByText("Google reCAPTCHA")).toBeTruthy();
    expect(screen.getByLabelText("Edit")).toBeTruthy();
    expect(screen.getByLabelText("Disable")).toBeTruthy();
    expect(screen.getByText("Site Key")).toBeTruthy();
    expect(screen.getByText("Secret Key")).toBeTruthy();
  });

  it("shows the enable action for a disabled configuration", () => {
    render(
      <ConfigureCaptchaList isLoading={false} configurations={[config({ isEnable: false })]} />,
    );
    expect(screen.getByLabelText("Enable")).toBeTruthy();
  });

  it("skips configurations with an unknown provider", () => {
    render(
      <ConfigureCaptchaList
        isLoading={false}
        configurations={[config({ provider: "mystery", itemId: "c2" })]}
      />,
    );
    expect(screen.queryByText("Google reCAPTCHA")).toBeNull();
  });
});
