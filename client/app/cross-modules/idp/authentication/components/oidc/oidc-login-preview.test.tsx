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
    expect(scrollRegion.className).toContain("sm:py-6");
    expect(scrollRegion.parentElement?.className).toContain("max-w-[30rem]");
    expect(screen.getByText(/SELISE Digital Platforms/).className).toContain("mt-auto");
    expect(screen.getByRole("button", { name: "Login" }).className).toContain("sm:mt-6");
  });

  it("reflects in-progress template changes on rerender", () => {
    const input = props();
    const { rerender } = render(<OidcLoginPreview {...input} />);
    const updated = structuredClone(input.template);
    updated.branding.brandName = "Acme";
    updated.branding.logoUrlLight = "https://cdn.example.com/acme.svg";
    updated.pages.login.heading = "Welcome to Acme";
    updated.pages.shared.footerText = "Acme {year}";

    rerender(<OidcLoginPreview {...input} template={updated} />);

    expect(screen.getByText("Welcome to Acme")).toBeTruthy();
    expect(screen.getByText("Acme")).toBeTruthy();
    expect(screen.getByAltText("Acme logo").getAttribute("src")).toBe(
      updated.branding.logoUrlLight,
    );
    expect(screen.getByText(`Acme ${new Date().getFullYear()}`)).toBeTruthy();
  });

  it("H3: falls back to the other mode's logo when only one slot has ever been set", () => {
    const input = { ...props(), resolvedTheme: "dark" as const };
    const template = structuredClone(input.template);
    template.branding.logoUrlLight = "https://cdn.example.com/light-only.svg";
    template.branding.logoUrlDark = null;

    render(<OidcLoginPreview {...input} template={template} />);

    expect(screen.getByAltText("Blocks IAM logo").getAttribute("src")).toBe(
      "https://cdn.example.com/light-only.svg",
    );
    expect(screen.queryByTestId("blocks-default-logo")).toBeNull();
  });

  it("H6/C7: shows the static default mark, unchanged by color edits, when no logo is set", () => {
    const input = props();
    const { rerender } = render(<OidcLoginPreview {...input} />);
    const defaultLogoSrcBefore = screen.getByTestId("blocks-default-logo").getAttribute("src");

    const recolored = structuredClone(input.template);
    recolored.theme.light.primary = "#ff0066";
    recolored.theme.light.secondary = "#00ff66";
    rerender(<OidcLoginPreview {...input} template={recolored} palette={recolored.theme.light} />);

    expect(screen.getByTestId("blocks-default-logo").getAttribute("src")).toBe(
      defaultLogoSrcBefore,
    );
  });

  it("drops the SSO divider when the separator is cleared, and shows it when set", () => {
    const input = props();
    const { rerender } = render(<OidcLoginPreview {...input} />);
    expect(screen.getByText(input.template.pages.login.ssoSeparatorText as string)).toBeTruthy();

    const withoutSso = structuredClone(input.template);
    withoutSso.pages.login.ssoSeparatorText = null;
    rerender(<OidcLoginPreview {...input} template={withoutSso} />);

    expect(screen.queryByText("or")).toBeNull();
    // The rest of the login page is untouched by a tenant that doesn't use SSO.
    expect(screen.getByText(withoutSso.pages.login.submitButton)).toBeTruthy();

    // The element after the divider carries its own top margin, so dropping the divider
    // can't collapse it onto the submit button.
    const signupPrompt = screen.getByText(withoutSso.pages.login.signupPrompt, {
      exact: false,
      selector: "p",
    });
    expect(signupPrompt.className).toContain("mt-3");
  });

  it("renders the mode toggle as blocks-iam does, so the sci-fi CSS can tint the active tab", () => {
    const input = props();
    render(<OidcLoginPreview {...input} />);

    // The tenant tint comes from `.oidc-scifi-root [role="tab"][data-state="active"]`
    // in sci-fi-oidc.css - the same override the real sign-in pages rely on - so the
    // active tab must expose Radix's data-state rather than an inline brand color.
    const light = screen.getByRole("tab", { name: "Light" });
    expect(light.getAttribute("data-state")).toBe("active");
    expect(light.style.backgroundColor).toBe("");
    expect(screen.getByRole("tab", { name: "Dark" }).getAttribute("data-state")).toBe("inactive");
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
