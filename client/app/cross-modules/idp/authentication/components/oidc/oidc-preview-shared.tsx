import { useEffect, useState, type ElementType, type ReactNode } from "react";
import { ArrowRight, Eye, Monitor, Moon, Sun } from "lucide-react";
import { Separator } from "@/components/ui-kits/separator/separator";
import type {
  IOidcUiTemplate,
  IOidcUiThemePalette,
} from "@blocks-idp/authentication/models/auth.oidc.model";
import "@blocks-idp/authentication/pages/oidc/sci-fi-oidc.css";
import { buildOidcBrandCssVars } from "./oidc-brand-css-vars";

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

export const OidcPreviewModeToggle = ({
  mode,
  onModeChange,
  showAuto = true,
}: {
  mode: OidcPreviewThemeMode;
  onModeChange: (mode: OidcPreviewThemeMode) => void;
  showAuto?: boolean;
}) => (
  <div
    role="tablist"
    aria-label="Preview theme"
    className="pointer-events-auto flex items-center gap-0.5 rounded-md p-0.5"
  >
    {THEME_OPTIONS.filter(({ value }) => showAuto || value !== "system").map(
      ({ value, label, Icon }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={label}
            onClick={() => onModeChange(value)}
            className="group flex items-center rounded-sm px-2 py-1 text-xs font-medium"
            style={{
              backgroundColor: active ? "var(--accent-soft)" : "transparent",
              color: active ? "var(--accent)" : "var(--muted)",
            }}
          >
            <Icon size={13} aria-hidden />
            <span className={`ml-1.5 ${active ? "inline" : "hidden"}`}>{label}</span>
          </button>
        );
      },
    )}
  </div>
);

const BlocksLogo = () => (
  <svg
    data-testid="blocks-default-logo"
    className="h-7 w-auto"
    viewBox="0 0 246 360"
    fill="var(--accent)"
    aria-hidden
  >
    <path d="M245.455 68.162V129.87L168.982 156.65V93.9637L245.455 68.162Z" />
    <path d="M240.389 62.3805L165.49 87.6573L5.30945 24.2563L85.3315 0L240.389 62.3805Z" />
    <path d="M161.797 93.8295V156.43L81.1141 122.607V188.07L0 152.738V29.6846L161.797 93.8295Z" />
    <path d="M76.4728 266.036L0 291.837V230.123L76.4728 203.329V266.036Z" />
    <path d="M160.122 360L5.07166 297.619L79.9639 272.343L240.144 335.743L160.122 360Z" />
    <path d="M245.454 330.315L83.6569 266.175V203.57L164.34 237.395V171.93L245.454 207.262V330.315Z" />
  </svg>
);

export type OidcPagePreviewProps = {
  template: IOidcUiTemplate;
  palette: IOidcUiThemePalette;
  resolvedTheme: OidcPreviewTheme;
  previewMode: OidcPreviewThemeMode;
  onPreviewModeChange: (mode: OidcPreviewThemeMode) => void;
  showAuto?: boolean;
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
}: OidcPagePreviewProps & { pageLabel: string; children: ReactNode }) => (
  <div
    className="oidc-scifi-root oidc-login-preview-embed pointer-events-none relative flex min-h-[520px] select-none flex-col overflow-hidden rounded-lg bg-[var(--bg)]"
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
    <div className="relative z-10 flex flex-1 items-stretch justify-center p-3 sm:p-4">
      <div className="oidc-login-preview-card flex w-full max-w-[26rem] flex-col overflow-hidden rounded-[1.5rem] bg-[var(--surface)] shadow-xl">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-4 pt-5 sm:px-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              {template.branding.logoUrl ? (
                <img
                  src={template.branding.logoUrl}
                  alt={`${template.branding.brandName} logo`}
                  className="h-7 max-w-28 object-contain"
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
          <div className="flex flex-1 flex-col justify-center">{children}</div>
          <p className="mt-4 text-xs text-[var(--muted)]">
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

export const PreviewHeading = ({ children }: { children: ReactNode }) => (
  <h1 className="mb-5 text-xl font-semibold leading-snug tracking-tight text-[var(--fg)] sm:text-2xl">
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
  <div className="flex flex-col gap-2">
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
    className="oidc-sci-fi-btn mt-2 flex w-full items-center justify-center gap-2"
  >
    <span>{children}</span>
    <ArrowRight size={16} />
  </button>
);

export const PreviewSuccess = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--accent-soft)] p-3">
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
