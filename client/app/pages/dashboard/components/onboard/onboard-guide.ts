import { ONBOARDING_GUIDE_TEMPLATE } from "./onboarding-guide.constant";

export { ONBOARDING_GUIDE_TEMPLATE };

/**
 * Stands in for a value this project hasn't configured yet.
 */
export const NOT_CONFIGURED = "<not configured>";

export type OnboardingPlaceholder = "X_BLOCKS_KEY";

export type OnboardingValues = Record<OnboardingPlaceholder, string>;

export type ResolvedOnboardingGuide = {
  /** Guide with every placeholder substituted — this is what gets copied. */
  markdown: string;
  /** The real values. */
  values: OnboardingValues;
};

const fillPlaceholders = (template: string, values: OnboardingValues): string =>
  template.replace(/\{\{(\w+)\}\}/g, (token, key: string) =>
    key in values ? values[key as OnboardingPlaceholder] || NOT_CONFIGURED : token,
  );

export type ResolveOnboardingGuideOptions = {
  /** The project key — `IProject.tenantId`. */
  tenantId?: string;
};

export const resolveOnboardingGuide = ({
  tenantId = "",
}: ResolveOnboardingGuideOptions): ResolvedOnboardingGuide => {
  const values: OnboardingValues = {
    X_BLOCKS_KEY: tenantId.trim(),
  };

  return {
    markdown: fillPlaceholders(ONBOARDING_GUIDE_TEMPLATE, values),
    values,
  };
};
