import type { IDomain } from "@seliseblocks/genesis-os/models";
import { ONBOARDING_GUIDE_TEMPLATE } from "./onboarding-guide.constant";

export { ONBOARDING_GUIDE_TEMPLATE };

/**
 * Stands in for a value this project hasn't configured yet. Angle brackets match
 * how the brief already marks the parts a human has to supply (`<appName>`,
 * `<publicOidcClientId>`).
 */
export const NOT_CONFIGURED = "<not configured>";

export type OnboardingPlaceholder = "X_BLOCKS_KEY" | "APP_DOMAIN" | "APP_HOST" | "BLOCKS_API_URL";

export type OnboardingValues = Record<OnboardingPlaceholder, string>;

export type ResolvedOnboardingGuide = {
  /** Guide with every placeholder substituted — this is what gets copied. */
  markdown: string;
  /** The real, unmasked values, for the summary strip. */
  values: OnboardingValues;
  /** Placeholders the project can't fill yet (no domain configured, etc.). */
  missing: OnboardingPlaceholder[];
};

/** Domains arrive both with and without a protocol prefix, and sometimes with a trailing slash. */
export const toHost = (value: string): string =>
  value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");

/** Last two labels of a host — `stg-a1b2c.seliseblocks.com` -> `seliseblocks.com`. */
const registrableDomain = (host: string): string => host.split(".").slice(-2).join(".");

/**
 * Same shape as the `MaskedText` component used in the project header, but as a
 * string so it can be substituted into the markdown itself.
 */
export const maskValue = (
  text: string,
  { showFirstN = 3, showLastN = 3, length = 20, char = "*" } = {},
): string => {
  if (!text) return "";
  const maskedCount = Math.max(length - showFirstN - showLastN, 0);
  return text.slice(0, showFirstN) + char.repeat(maskedCount) + text.slice(-showLastN);
};

const fillPlaceholders = (template: string, values: OnboardingValues): string =>
  template.replace(/\{\{(\w+)\}\}/g, (token, key: string) =>
    key in values ? values[key as OnboardingPlaceholder] || NOT_CONFIGURED : token,
  );

export type ResolveOnboardingGuideOptions = {
  /** The project key — `IProject.tenantId`. */
  tenantId?: string;
  /** The application domain the guide should target. */
  domain?: IDomain | null;
  /**
   * Masks the project key in the returned `markdown` only. `values` always
   * holds the real key, so copy and download stay complete.
   */
  maskKey?: boolean;
};

export const resolveOnboardingGuide = ({
  tenantId = "",
  domain,
  maskKey = false,
}: ResolveOnboardingGuideOptions): ResolvedOnboardingGuide => {
  const appHost = toHost(domain?.domain ?? "");
  // `blocks new web` derives the API URL from the registrable domain; the
  // cookie domain already is that, so prefer it and only fall back to slicing.
  const apiHost = toHost(domain?.cookieDomain ?? "") || (appHost ? registrableDomain(appHost) : "");

  const values: OnboardingValues = {
    X_BLOCKS_KEY: tenantId.trim(),
    APP_DOMAIN: appHost ? `https://${appHost}` : "",
    APP_HOST: appHost,
    BLOCKS_API_URL: apiHost ? `https://blocksapi.${apiHost}` : "",
  };

  const missing = (Object.keys(values) as OnboardingPlaceholder[]).filter((key) => !values[key]);

  const displayValues: OnboardingValues =
    maskKey && values.X_BLOCKS_KEY
      ? { ...values, X_BLOCKS_KEY: maskValue(values.X_BLOCKS_KEY) }
      : values;

  return {
    markdown: fillPlaceholders(ONBOARDING_GUIDE_TEMPLATE, displayValues),
    values,
    missing,
  };
};

/**
 * Swaps the masked key back for the real one. The rendered guide can show a
 * masked key while every copy affordance still hands over a runnable command.
 */
export const revealKey = (text: string, maskedKey: string, realKey: string): string =>
  maskedKey && realKey ? text.split(maskedKey).join(realKey) : text;
