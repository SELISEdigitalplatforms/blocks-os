import type { CSSProperties } from "react";
import type { IOidcUiThemePalette } from "@blocks-idp/authentication/models/auth.oidc.model";

type OidcThemeStyle = CSSProperties & Record<`--${string}`, string>;

export const buildOidcBrandCssVars = (palette: IOidcUiThemePalette): OidcThemeStyle => ({
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
