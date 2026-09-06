import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_OIDC_UI_TEMPLATE } from "./oidc-template-defaults";
import { OidcTemplatePreview } from "./oidc-template-preview";

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe("OidcTemplatePreview", () => {
  it("renders the page selected by the shared page switcher", () => {
    render(
      <OidcTemplatePreview
        template={DEFAULT_OIDC_UI_TEMPLATE}
        selectedPage="signup"
        previewMode="light"
        onPreviewModeChange={vi.fn()}
        showAuto
      />,
    );
    expect(screen.getByLabelText("Signup page preview")).toBeTruthy();
    expect(screen.getByText(DEFAULT_OIDC_UI_TEMPLATE.pages.signup.heading)).toBeTruthy();
  });

  it("resolves Auto to the system palette", () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    render(
      <OidcTemplatePreview
        template={DEFAULT_OIDC_UI_TEMPLATE}
        selectedPage="forgotPassword"
        previewMode="system"
        onPreviewModeChange={vi.fn()}
        showAuto
      />,
    );

    const root = screen.getByLabelText("Forgot Password page preview");
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(root.style.getPropertyValue("--bg")).toBe(
      DEFAULT_OIDC_UI_TEMPLATE.theme.dark.background,
    );
  });
});
