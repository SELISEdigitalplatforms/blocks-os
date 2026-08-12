import { useEffect, useState, type ElementType } from "react";
import { ArrowRight, Eye, Monitor, Moon, Sun } from "lucide-react";
import { Separator } from "@/components/ui-kits/separator/separator";
import "@blocks-idp/authentication/pages/oidc/sci-fi-oidc.css";
import { buildOidcBrandCssVars } from "./oidc-brand-css-vars";

const DEFAULT_BRAND_COLOR = "#124091";

type PreviewTheme = "light" | "dark";
type PreviewThemeMode = PreviewTheme | "system";

const PREVIEW_THEME_OPTIONS: Array<{
  value: PreviewThemeMode;
  Icon: ElementType;
  label: string;
}> = [
  { value: "system", Icon: Monitor, label: "Auto" },
  { value: "light", Icon: Sun, label: "Light" },
  { value: "dark", Icon: Moon, label: "Dark" },
];

const readDocumentTheme = (): PreviewTheme =>
  typeof document !== "undefined" && document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";

const getSystemTheme = (): PreviewTheme =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

/** Preview-only theme toggle — matches production ModeToggle UI without changing app theme. */
const OidcPreviewModeToggle = ({
  mode,
  onModeChange,
}: {
  mode: PreviewThemeMode;
  onModeChange: (mode: PreviewThemeMode) => void;
}) => (
  <div
    role="tablist"
    aria-label="Preview theme"
    className="pointer-events-auto flex items-center gap-0.5 rounded-md p-0.5"
  >
    {PREVIEW_THEME_OPTIONS.map(({ value, Icon, label }) => {
      const isActive = mode === value;
      return (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={isActive}
          aria-label={label}
          onClick={() => onModeChange(value)}
          className="group flex h-auto items-center rounded-sm px-2 py-1 text-xs font-medium transition-colors"
          style={{
            backgroundColor: isActive ? "var(--accent-soft)" : "transparent",
            color: isActive ? "var(--accent)" : "var(--muted)",
            boxShadow: isActive ? "0 1px 2px rgba(0, 0, 0, 0.06)" : "none",
          }}
        >
          <Icon size={13} aria-hidden />
          <span className={`ml-1.5 ${isActive ? "inline" : "hidden"}`}>{label}</span>
        </button>
      );
    })}
  </div>
);

export type OidcLoginPreviewProps = {
  clientLogoUrl?: string | null;
  clientBrandColor?: string | null;
};

const BlocksLogo = () => (
  <svg
    className="h-7 w-auto"
    viewBox="0 0 246 360"
    xmlns="http://www.w3.org/2000/svg"
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

const SectionHeading = ({ text, dimFirst = 3 }: { text: string; dimFirst?: number }) => {
  const words = text.split(" ");
  return (
    <h1 className="mb-5 font-sans text-xl font-semibold leading-snug tracking-tight sm:max-w-sm sm:text-2xl">
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          className="mr-1.5 inline-block"
          style={{ color: i < dimFirst ? "var(--muted)" : "var(--fg)" }}
        >
          {word}
        </span>
      ))}
    </h1>
  );
};

export const OidcLoginPreview = ({
  clientLogoUrl,
  clientBrandColor = DEFAULT_BRAND_COLOR,
}: OidcLoginPreviewProps) => {
  const [previewMode, setPreviewMode] = useState<PreviewThemeMode>(readDocumentTheme);
  const [systemTheme, setSystemTheme] = useState<PreviewTheme>(getSystemTheme);

  useEffect(() => {
    if (previewMode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setSystemTheme(getSystemTheme());
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, [previewMode]);

  const previewTheme: PreviewTheme = previewMode === "system" ? systemTheme : previewMode;

  const brandVars = buildOidcBrandCssVars(clientBrandColor || DEFAULT_BRAND_COLOR);

  return (
    <div
      className="oidc-scifi-root oidc-login-preview-embed pointer-events-none relative flex min-h-[380px] select-none flex-col overflow-hidden rounded-none bg-[var(--bg)] sm:min-h-[460px] sm:rounded-lg lg:min-h-[520px]"
      data-theme={previewTheme}
      style={brandVars}
      aria-label="Login page preview"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            previewTheme === "light"
              ? "linear-gradient(180deg, rgba(0,102,178,0.06) 0%, rgba(245,247,251,0) 60%)"
              : "radial-gradient(ellipse at 50% 0%, rgba(0,102,178,0.12) 0%, transparent 70%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 flex flex-1 items-stretch sm:items-center sm:justify-center sm:p-4">
        <div className="oidc-login-preview-card flex w-full min-h-0 flex-1 flex-col overflow-hidden rounded-none bg-[var(--surface)] shadow-none sm:max-w-[23rem] sm:min-h-[460px] sm:flex-none sm:rounded-[1.5rem] sm:shadow-xl md:max-w-[26rem]">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 pt-4 sm:px-6 sm:pb-4 sm:pt-5">
            <div className="mb-3 flex items-center justify-between gap-2 sm:mb-4">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                {clientLogoUrl ? (
                  <span
                    className="inline-flex h-7 items-center justify-center rounded-md px-1.5"
                    style={{ backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
                  >
                    <img
                      src={clientLogoUrl}
                      alt="Client logo"
                      className="h-5 max-w-[120px] object-contain"
                    />
                  </span>
                ) : (
                  <BlocksLogo />
                )}
                <Separator orientation="vertical" className="h-4 bg-[var(--border)]" />
                <span className="truncate font-sans text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--fg)] sm:text-xs sm:tracking-[.18em]">
                  Blocks IAM
                </span>
              </div>
              <div className="pointer-events-auto">
                <OidcPreviewModeToggle mode={previewMode} onModeChange={setPreviewMode} />
              </div>
            </div>

            <div className="flex flex-1 flex-col justify-center">
              <SectionHeading text="Sign in to continue to your application" dimFirst={3} />

              <div className="flex w-full flex-col gap-4 sm:gap-5">
                <div className="flex flex-col gap-2">
                  <label htmlFor="oidc-preview-email" className="oidc-sci-fi-label">
                    Work Email
                  </label>
                  <input
                    id="oidc-preview-email"
                    type="email"
                    placeholder="name@company.com"
                    className="oidc-sci-fi-input"
                    disabled
                    tabIndex={-1}
                    readOnly
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="oidc-preview-password" className="oidc-sci-fi-label">
                      Password
                    </label>
                    <span className="oidc-sci-fi-link" style={{ fontSize: "0.75rem" }}>
                      Forgot?
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      id="oidc-preview-password"
                      type="password"
                      value="••••••••"
                      className="oidc-sci-fi-input"
                      style={{ paddingRight: "2.75rem" }}
                      disabled
                      tabIndex={-1}
                      readOnly
                    />
                    <Eye
                      className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
                      style={{ color: "var(--muted)" }}
                      aria-hidden
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled
                  tabIndex={-1}
                  className="oidc-sci-fi-btn mt-2 flex w-full items-center justify-center gap-2 sm:mt-3"
                >
                  <span>Login</span>
                  <ArrowRight size={16} />
                </button>
              </div>

              <div className="mt-3 sm:mt-4">
                <p className="oidc-font-rajdhani text-xs" style={{ color: "var(--muted)" }}>
                  Not a member?{" "}
                  <span className="oidc-sci-fi-link" style={{ fontSize: "0.75rem" }}>
                    Create an account
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-3 sm:mt-4">
              <p className="font-sans text-xs text-[var(--muted)]">
                © {new Date().getFullYear()} SELISE Digital Platforms. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
