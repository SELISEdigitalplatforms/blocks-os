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
});
