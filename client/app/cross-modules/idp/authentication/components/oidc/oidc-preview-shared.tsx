import { useEffect, useState, type ElementType, type ReactNode } from "react";
import { ArrowRight, Eye, Monitor, Moon, Sun } from "lucide-react";
import { Separator } from "@/components/ui-kits/separator/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs";
import type {
  IOidcUiTemplate,
  IOidcUiThemePalette,
} from "@blocks-idp/authentication/models/auth.oidc.model";
import "@blocks-idp/authentication/pages/oidc/sci-fi-oidc.css";
import { buildOidcBrandCssVars } from "./oidc-brand-css-vars";
import { resolveOidcLogoUrl } from "./oidc-template-defaults";

export type OidcPreviewTheme = "light" | "dark";
export type OidcPreviewThemeMode = OidcPreviewTheme | "system";

const readSystemTheme = (): OidcPreviewTheme =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

const THEME_OPTIONS: Array<{
  value: OidcPreviewThemeMode;
  label: string;
  Icon: ElementType;
}> = [
  { value: "system", label: "Auto", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

/**
 * The preview's copy of blocks-iam's shared `ModeToggle` - same Tabs markup and the
 * same classes, so the selected tab picks up the tenant palette through the
 * `.oidc-scifi-root [role="tab"][data-state="active"]` override in sci-fi-oidc.css,
 * exactly as it does on the real sign-in pages. Only the controlled `mode` props and
 * the `showAuto` filter are ours: the editor drives the toggle instead of the app theme.
 */
export const OidcPreviewModeToggle = ({
  mode,
  onModeChange,
  showAuto = true,
}: {
  mode: OidcPreviewThemeMode;
  onModeChange: (mode: OidcPreviewThemeMode) => void;
  showAuto?: boolean;
}) => (
  <Tabs value={mode} onValueChange={(value) => onModeChange(value as OidcPreviewThemeMode)}>
    <TabsList
      aria-label="Preview theme"
      className="pointer-events-auto h-auto gap-0.5 rounded-md !bg-transparent p-0.5"
    >
      {THEME_OPTIONS.filter(({ value }) => showAuto || value !== "system").map(
        ({ value, label, Icon }) => (
          <TabsTrigger
            key={value}
            value={value}
            // The label is hidden until selected, so it can't carry the accessible
            // name on its own.
            aria-label={label}
            className="group h-auto rounded-sm px-2 py-1 text-xs font-medium data-[state=active]:bg-[hsl(var(--primary)/0.1)] data-[state=active]:text-[hsl(var(--primary))] data-[state=active]:shadow-sm data-[state=inactive]:text-[hsl(var(--muted-foreground)/0.9)] data-[state=inactive]:hover:text-[hsl(var(--foreground)/0.9)]"
          >
            <Icon size={13} aria-hidden />
            <span className="ml-1.5 hidden group-data-[state=active]:inline">{label}</span>
          </TabsTrigger>
        ),
      )}
    </TabsList>
  </Tabs>
);

/**
 * The static mark blocks-iam's real pages fall back to when a tenant hasn't
 * uploaded a logo - the exact same CDN asset, not a lookalike, so this preview
 * can never visually drift from production. It never recolors with the brand
 * palette, because the real fallback doesn't either.
 */
const BlocksLogo = () => (
  <img
    data-testid="blocks-default-logo"
    src="https://az-cdn.selise.biz/selisecdn/cdn/blocks/logos/selise_blocks_logo_small.svg"
    alt=""
    className="h-7 w-auto"
    aria-hidden
  />
);

export type OidcPagePreviewProps = {
  template: IOidcUiTemplate;
  palette: IOidcUiThemePalette;
  resolvedTheme: OidcPreviewTheme;
  previewMode: OidcPreviewThemeMode;
  onPreviewModeChange: (mode: OidcPreviewThemeMode) => void;
  showAuto?: boolean;
  /**
   * Mirrors the tenant's IAM setting so the activation preview shows the page users will
   * actually get. Undefined means "collect a password", the server-side default.
   */
  collectPasswordOnActivation?: boolean;
};

export const OidcPreviewShell = ({
  template,
  palette,
  resolvedTheme,
  previewMode,
  onPreviewModeChange,
  showAuto,
  pageLabel,
  children,
}: OidcPagePreviewProps & { pageLabel: string; children: ReactNode }) => {
  const resolvedLogoUrl = resolveOidcLogoUrl(template.branding, resolvedTheme);
  return (
    <div
      className="oidc-scifi-root oidc-login-preview-embed pointer-events-none relative flex min-h-[500px] select-none flex-col overflow-hidden rounded-lg bg-[var(--bg)] xl:h-full xl:min-h-0"
      data-theme={resolvedTheme}
      style={buildOidcBrandCssVars(palette)}
      aria-label={`${pageLabel} page preview`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            resolvedTheme === "light"
              ? "linear-gradient(180deg, color-mix(in srgb, var(--accent) 8%, transparent), transparent 60%)"
              : "radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%)",
        }}
        aria-hidden
      />
      <div className="relative z-10 flex min-h-0 flex-1 items-stretch justify-center p-3 sm:p-4 2xl:p-6">
        <div className="oidc-login-preview-card flex min-h-0 w-full max-w-[30rem] flex-col overflow-hidden rounded-[1.5rem] bg-[var(--surface)] shadow-xl">
          <div
            className="pointer-events-auto flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 py-5 outline-none [scrollbar-gutter:stable] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] sm:px-7 sm:py-6 2xl:px-9 2xl:py-8"
            tabIndex={0}
            aria-label={`${pageLabel} preview content`}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-5 2xl:mb-6">
              <div className="flex min-w-0 items-center gap-3">
                {resolvedLogoUrl ? (
                  <img
                    src={resolvedLogoUrl}
                    alt={`${template.branding.brandName} logo`}
                    className="h-7 w-auto max-w-28 object-contain"
                  />
                ) : (
                  <BlocksLogo />
                )}
                <Separator orientation="vertical" className="h-4 bg-[var(--border)]" />
                <span className="truncate text-xs font-semibold uppercase tracking-[.18em] text-[var(--fg)]">
                  {template.branding.brandName}
                </span>
              </div>
              <OidcPreviewModeToggle
                mode={previewMode}
                onModeChange={onPreviewModeChange}
                showAuto={showAuto}
              />
            </div>
            <div className="flex flex-col">{children}</div>
            <p className="mt-auto shrink-0 pt-5 text-xs text-[var(--muted)] sm:pt-6 2xl:pt-8">
              {template.pages.shared.footerText.replaceAll(
                "{year}",
                String(new Date().getFullYear()),
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const PreviewHeading = ({ children }: { children: ReactNode }) => (
  <h1 className="mb-4 text-xl font-semibold leading-snug tracking-tight text-[var(--fg)] sm:mb-5 sm:text-2xl 2xl:mb-6">
    {children}
  </h1>
);

export const PreviewField = ({
  label,
  password = false,
}: {
  label: string;
  password?: boolean;
}) => (
  <div className="flex flex-col gap-1.5 sm:gap-2">
    <span className="oidc-sci-fi-label">{label}</span>
    <div className="relative">
      <input
        className="oidc-sci-fi-input"
        value={password ? "••••••••" : ""}
        placeholder={password ? undefined : "name@company.com"}
        disabled
        readOnly
      />
      {password && (
        <Eye className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
      )}
    </div>
  </div>
);

export const PreviewButton = ({ children }: { children: ReactNode }) => (
  <button
    type="button"
    disabled
    className="oidc-sci-fi-btn mt-5 flex w-full items-center justify-center gap-2 sm:mt-6 2xl:mt-8"
  >
    <span>{children}</span>
    <ArrowRight size={16} />
  </button>
);

/**
 * The divider between the password form and the SSO buttons, built exactly as the real
 * login and signup pages build it: a rule either side in the border color, the tenant's
 * separator copy between them in the muted color. Blank copy means the tenant offers no
 * SSO, so nothing is drawn - and the element below supplies its own top margin, so the
 * spacing holds either way.
 */
export const PreviewSsoSeparator = ({ text }: { text: string | null }) =>
  text ? (
    <div className="mt-3 flex items-center gap-3">
      <div className="flex-1 border-t" style={{ borderColor: "var(--border)" }} />
      <span className="oidc-font-rajdhani text-xs text-[var(--muted)]">{text}</span>
      <div className="flex-1 border-t" style={{ borderColor: "var(--border)" }} />
    </div>
  ) : null;

export const PreviewSuccess = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--accent-soft)] p-3 sm:mt-5">
    <p className="text-sm font-semibold text-[var(--success)]">{title}</p>
    <p className="text-xs text-[var(--muted)]">{subtitle}</p>
  </div>
);

export const useResolvedPreviewTheme = (mode: OidcPreviewThemeMode): OidcPreviewTheme => {
  const [systemTheme, setSystemTheme] = useState<OidcPreviewTheme>(readSystemTheme);

  useEffect(() => {
    if (mode !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemTheme(readSystemTheme());
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [mode]);

  return mode === "system" ? systemTheme : mode;
};
