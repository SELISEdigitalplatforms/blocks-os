import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OidcLoginPreview } from "./oidc-login-preview";
import { DEFAULT_OIDC_UI_TEMPLATE } from "./oidc-template-defaults";

const props = () => ({
  template: structuredClone(DEFAULT_OIDC_UI_TEMPLATE),
  palette: DEFAULT_OIDC_UI_TEMPLATE.theme.light,
  resolvedTheme: "light" as const,
  previewMode: "light" as const,
  onPreviewModeChange: vi.fn(),
  showAuto: true,
});

describe("OidcLoginPreview", () => {
  it("renders all login copy, branding, footer, and palette variables", () => {
    const input = props();
    render(<OidcLoginPreview {...input} />);

    for (const value of Object.values(input.template.pages.login)) {
      expect(screen.getByText(value)).toBeTruthy();
    }
    expect(screen.getByText("Blocks IAM")).toBeTruthy();
    expect(screen.getByTestId("blocks-default-logo")).toBeTruthy();
    expect(screen.getByText(/SELISE Digital Platforms/)).toBeTruthy();

    const root = screen.getByLabelText("Login page preview");
    expect(root.getAttribute("data-theme")).toBe("light");
    expect(root.style.getPropertyValue("--accent")).toBe(input.palette.primary);
    expect(root.style.getPropertyValue("--danger")).toBe(input.palette.danger);
    expect(root.style.getPropertyValue("--border-strong")).toBe(input.palette.borderStrong);

    const scrollRegion = screen.getByLabelText("Login preview content");
    expect(scrollRegion.getAttribute("tabindex")).toBe("0");
    expect(scrollRegion.className).toContain("overflow-y-auto");
  });

  it("reflects in-progress template changes on rerender", () => {
    const input = props();
    const { rerender } = render(<OidcLoginPreview {...input} />);
    const updated = structuredClone(input.template);
    updated.branding.brandName = "Acme";
    updated.branding.logoUrl = "https://cdn.example.com/acme.svg";
    updated.pages.login.heading = "Welcome to Acme";
    updated.pages.shared.footerText = "Acme {year}";

    rerender(<OidcLoginPreview {...input} template={updated} />);

    expect(screen.getByText("Welcome to Acme")).toBeTruthy();
    expect(screen.getByText("Acme")).toBeTruthy();
    expect(screen.getByAltText("Acme logo").getAttribute("src")).toBe(updated.branding.logoUrl);
    expect(screen.getByText(`Acme ${new Date().getFullYear()}`)).toBeTruthy();
  });

  it("reports preview mode changes and can hide Auto while editing a palette", async () => {
    const input = props();
    const user = userEvent.setup();
    const { rerender } = render(<OidcLoginPreview {...input} />);

    await user.click(screen.getByRole("tab", { name: "Dark" }));
    expect(input.onPreviewModeChange).toHaveBeenCalledWith("dark");
    expect(screen.getByRole("tab", { name: "Auto" })).toBeTruthy();

    rerender(<OidcLoginPreview {...input} showAuto={false} />);
    expect(screen.queryByRole("tab", { name: "Auto" })).toBeNull();
  });
});
