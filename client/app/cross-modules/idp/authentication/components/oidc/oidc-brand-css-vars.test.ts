import { describe, expect, it } from "vitest";
import { buildOidcBrandCssVars } from "./oidc-brand-css-vars";
import { DEFAULT_OIDC_UI_TEMPLATE } from "./oidc-template-defaults";

describe("buildOidcBrandCssVars", () => {
  it.each(["light", "dark"] as const)("maps every %s palette field", (mode) => {
    const palette = DEFAULT_OIDC_UI_TEMPLATE.theme[mode];

    expect(buildOidcBrandCssVars(palette)).toEqual({
      "--bg": palette.background,
      "--surface": palette.surface,
      "--accent": palette.primary,
      "--accent2": palette.secondary,
      "--fg": palette.text,
      "--muted": palette.mutedText,
      "--success": palette.success,
      "--danger": palette.danger,
      "--border": palette.border,
      "--border-strong": palette.borderStrong,
      "--accent-soft": palette.accentSoft,
    });
    expect(Object.keys(buildOidcBrandCssVars(palette))).toHaveLength(11);
  });
});
