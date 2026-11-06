import { describe, expect, it } from "vitest";
import {
  DEFAULT_OIDC_UI_TEMPLATE,
  normalizeOidcUiTemplate,
  resolveOidcLogoUrl,
} from "./oidc-template-defaults";

describe("resolveOidcLogoUrl", () => {
  it("H3: falls back to the dark logo when only dark has been set and the mode is light", () => {
    expect(
      resolveOidcLogoUrl(
        { logoUrlLight: null, logoUrlDark: "https://cdn.example.com/dark.png" },
        "light",
      ),
    ).toBe("https://cdn.example.com/dark.png");
  });

  it("H3: falls back to the light logo when only light has been set and the mode is dark", () => {
    expect(
      resolveOidcLogoUrl(
        { logoUrlLight: "https://cdn.example.com/light.png", logoUrlDark: null },
        "dark",
      ),
    ).toBe("https://cdn.example.com/light.png");
  });

  it("H2: prefers each mode's own logo when both are set", () => {
    const branding = {
      logoUrlLight: "https://cdn.example.com/light.png",
      logoUrlDark: "https://cdn.example.com/dark.png",
    };
    expect(resolveOidcLogoUrl(branding, "light")).toBe(branding.logoUrlLight);
    expect(resolveOidcLogoUrl(branding, "dark")).toBe(branding.logoUrlDark);
  });

  it("H6: resolves to null for both modes when neither slot has ever been set", () => {
    const branding = { logoUrlLight: null, logoUrlDark: null };
    expect(resolveOidcLogoUrl(branding, "light")).toBeNull();
    expect(resolveOidcLogoUrl(branding, "dark")).toBeNull();
  });

  it("C5: light and dark are independent even when currently equal - not a live link", () => {
    const branding = {
      logoUrlLight: "https://cdn.example.com/same.png",
      logoUrlDark: "https://cdn.example.com/same.png",
    };
    expect(resolveOidcLogoUrl(branding, "light")).toBe("https://cdn.example.com/same.png");
    const updated = { ...branding, logoUrlLight: "https://cdn.example.com/new-light.png" };
    expect(resolveOidcLogoUrl(updated, "light")).toBe("https://cdn.example.com/new-light.png");
    expect(resolveOidcLogoUrl(updated, "dark")).toBe("https://cdn.example.com/same.png");
  });
});

describe("normalizeOidcUiTemplate", () => {
  it("C8: fills logoUrlLight, logoUrlDark, and buttonText from defaults when absent", () => {
    const legacy = structuredClone(DEFAULT_OIDC_UI_TEMPLATE) as unknown as Record<
      string,
      Record<string, unknown>
    >;
    delete legacy.branding.logoUrlLight;
    delete legacy.branding.logoUrlDark;
    delete (legacy.theme as Record<string, Record<string, unknown>>).light.buttonText;
    delete (legacy.theme as Record<string, Record<string, unknown>>).dark.buttonText;

    const normalized = normalizeOidcUiTemplate(legacy as never);

    expect(normalized.branding.logoUrlLight).toBeNull();
    expect(normalized.branding.logoUrlDark).toBeNull();
    expect(normalized.theme.light.buttonText).toBe(DEFAULT_OIDC_UI_TEMPLATE.theme.light.buttonText);
    expect(normalized.theme.dark.buttonText).toBe(DEFAULT_OIDC_UI_TEMPLATE.theme.dark.buttonText);
  });

  it("C5: keeps logoUrlLight and logoUrlDark as independently-set values when both are present", () => {
    const template = structuredClone(DEFAULT_OIDC_UI_TEMPLATE);
    template.branding.logoUrlLight = "https://cdn.example.com/light.png";
    template.branding.logoUrlDark = "https://cdn.example.com/dark.png";

    const normalized = normalizeOidcUiTemplate(template);

    expect(normalized.branding.logoUrlLight).toBe("https://cdn.example.com/light.png");
    expect(normalized.branding.logoUrlDark).toBe("https://cdn.example.com/dark.png");
  });

  describe("layout.showAnimationPanel", () => {
    const withLayout = (layout: unknown) => {
      const template = structuredClone(DEFAULT_OIDC_UI_TEMPLATE) as unknown as Record<
        string,
        unknown
      >;
      if (layout === undefined) delete template.layout;
      else template.layout = layout;
      return normalizeOidcUiTemplate(template as never);
    };

    it("C1: defaults to true when layout is absent (a pre-Phase-1 blocks-iam)", () => {
      expect(withLayout(undefined).layout).toEqual({ showAnimationPanel: true });
    });

    it("C1: defaults to true when layout is null", () => {
      expect(withLayout(null).layout).toEqual({ showAnimationPanel: true });
    });

    it("C1: defaults to true when showAnimationPanel is null or missing", () => {
      expect(withLayout({ showAnimationPanel: null }).layout.showAnimationPanel).toBe(true);
      expect(withLayout({}).layout.showAnimationPanel).toBe(true);
    });

    it("H2: keeps a stored false", () => {
      expect(withLayout({ showAnimationPanel: false }).layout.showAnimationPanel).toBe(false);
    });

    it("C2: treats any value other than the literal false as true", () => {
      for (const value of ["false", 0, "", "no", {}]) {
        expect(withLayout({ showAnimationPanel: value }).layout.showAnimationPanel).toBe(true);
      }
    });

    it("C3: leaves other fields' stored nulls untouched", () => {
      const template = structuredClone(DEFAULT_OIDC_UI_TEMPLATE);
      template.pages.accountSelector.subheading = null;
      template.pages.mfa.resendButton = null;
      template.pages.signup.ssoSeparatorText = null;

      const normalized = normalizeOidcUiTemplate(template);

      expect(normalized.pages.accountSelector.subheading).toBeNull();
      expect(normalized.pages.mfa.resendButton).toBeNull();
      expect(normalized.pages.signup.ssoSeparatorText).toBeNull();
    });
  });
});
