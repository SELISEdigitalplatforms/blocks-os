import type {
  IOidcUiTemplate,
  IOidcUiThemePalette,
} from "@blocks-idp/authentication/models/auth.oidc.model";

export const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const RGBA_COLOR_PATTERN =
  /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*((?:\d+(?:\.\d+)?|\.\d+))\s*\)$/i;

export const HEX_COLOR_MESSAGE = "must be a valid hex color (#RGB or #RRGGBB)";
export const HEX_OR_RGBA_COLOR_MESSAGE =
  "must be a valid hex color (#RGB or #RRGGBB) or rgba(r,g,b,a) color";
export const TEXT_MESSAGE = "must be between 1 and 200 characters";

export const isRgbaColor = (value: string) => {
  const match = value.match(RGBA_COLOR_PATTERN);
  if (!match) return false;
  const [red, green, blue, alpha] = match.slice(1).map(Number);
  return red <= 255 && green <= 255 && blue <= 255 && alpha >= 0 && alpha <= 1;
};

export const THEME_FIELDS: Array<{
  key: keyof IOidcUiThemePalette;
  label: string;
  acceptsRgba: boolean;
}> = [
  { key: "primary", label: "Primary", acceptsRgba: false },
  { key: "secondary", label: "Secondary", acceptsRgba: false },
  { key: "background", label: "Background", acceptsRgba: false },
  { key: "surface", label: "Surface", acceptsRgba: false },
  { key: "text", label: "Text", acceptsRgba: false },
  { key: "mutedText", label: "Muted text", acceptsRgba: false },
  { key: "success", label: "Success", acceptsRgba: false },
  { key: "danger", label: "Danger", acceptsRgba: false },
  { key: "border", label: "Border", acceptsRgba: true },
  { key: "borderStrong", label: "Strong border", acceptsRgba: true },
  { key: "accentSoft", label: "Soft accent", acceptsRgba: true },
];

export type OidcPageKey = Exclude<keyof IOidcUiTemplate["pages"], "shared">;

export const PAGE_OPTIONS: Array<{ key: OidcPageKey; label: string }> = [
  { key: "signup", label: "Signup" },
  { key: "login", label: "Login" },
  { key: "forgotPassword", label: "Forgot Password" },
  { key: "resetPassword", label: "Reset Password" },
  { key: "activation", label: "Activation" },
  { key: "mfa", label: "MFA" },
  { key: "accountSelector", label: "Account Selector" },
];

type PageField = { key: string; label: string; optional?: boolean; multiline?: boolean };

export const PAGE_FIELDS: Record<OidcPageKey, PageField[]> = {
  login: [
    { key: "heading", label: "Heading" },
    { key: "emailLabel", label: "Email label" },
    { key: "passwordLabel", label: "Password label" },
    { key: "forgotPasswordLink", label: "Forgot password link" },
    { key: "submitButton", label: "Submit button" },
    { key: "signupPrompt", label: "Signup prompt" },
    { key: "signupLink", label: "Signup link" },
    { key: "ssoSeparatorText", label: "SSO separator" },
    { key: "activationErrorTitle", label: "Activation error title" },
    { key: "activationErrorMessage", label: "Activation error message", multiline: true },
    { key: "activateAccountButton", label: "Activate account button" },
    { key: "backToLoginButton", label: "Back to login button" },
  ],
  signup: [
    { key: "heading", label: "Heading" },
    { key: "firstNameLabel", label: "First name label" },
    { key: "lastNameLabel", label: "Last name label" },
    { key: "emailLabel", label: "Email label" },
    { key: "organizationNameLabel", label: "Organization name label" },
    { key: "termsPrefix", label: "Terms prefix" },
    { key: "termsLinkText", label: "Terms link text" },
    { key: "termsConjunction", label: "Terms conjunction" },
    { key: "privacyLinkText", label: "Privacy link text" },
    { key: "submitButton", label: "Submit button" },
    { key: "creatingButton", label: "Creating button" },
    { key: "loginPrompt", label: "Login prompt" },
    { key: "loginLink", label: "Login link" },
    { key: "ssoSeparatorText", label: "SSO separator" },
    { key: "successTitle", label: "Success title" },
    { key: "successSubtitle", label: "Success subtitle" },
    { key: "emailSentTitle", label: "Email sent title" },
    { key: "emailSentSubtitle", label: "Email sent subtitle", multiline: true },
    { key: "resendPromptTitle", label: "Resend prompt title" },
    { key: "resendPromptSubtitle", label: "Resend prompt subtitle", multiline: true },
    { key: "resendButton", label: "Resend button" },
    { key: "loginSentPrompt", label: "Sent page login prompt" },
    { key: "loginSentLink", label: "Sent page login link" },
  ],
  forgotPassword: [
    { key: "heading", label: "Heading" },
    { key: "introText", label: "Intro text", multiline: true },
    { key: "emailLabel", label: "Email label" },
    { key: "submitButton", label: "Submit button" },
    { key: "backToLoginButton", label: "Back to login button" },
    { key: "successTitle", label: "Success title" },
    { key: "successSubtitle", label: "Success subtitle", multiline: true },
    { key: "resendPromptTitle", label: "Resend prompt title" },
    { key: "resendPromptSubtitle", label: "Resend prompt subtitle", multiline: true },
    { key: "resendButton", label: "Resend button" },
    { key: "loginPrompt", label: "Login prompt" },
    { key: "loginLink", label: "Login link" },
  ],
  resetPassword: [
    { key: "heading", label: "Heading" },
    { key: "passwordLabel", label: "Password label" },
    { key: "confirmPasswordLabel", label: "Confirm password label" },
    { key: "logoutFromDevicesLabel", label: "Logout from devices label" },
    { key: "submitButton", label: "Submit button" },
    { key: "resettingButton", label: "Resetting button" },
    { key: "missingCodeMessage", label: "Missing code message", multiline: true },
    { key: "requestNewLinkButton", label: "Request new link button" },
    { key: "backToLoginButton", label: "Back to login button" },
    { key: "successTitle", label: "Success title" },
    { key: "successSubtitle", label: "Success subtitle" },
    { key: "readyTitle", label: "Success page action title" },
    { key: "readySubtitle", label: "Success page action subtitle", multiline: true },
    { key: "loginButton", label: "Success page login button" },
  ],
  activation: [
    { key: "heading", label: "Heading" },
    { key: "firstNameLabel", label: "First name label" },
    { key: "lastNameLabel", label: "Last name label" },
    { key: "passwordLabel", label: "Password label" },
    { key: "confirmPasswordLabel", label: "Confirm password label" },
    { key: "submitButton", label: "Submit button" },
    { key: "activatingButton", label: "Activating button" },
    { key: "successTitle", label: "Success title" },
    { key: "successSubtitle", label: "Success subtitle" },
    { key: "invalidHeading", label: "Invalid link heading" },
    { key: "invalidMessage", label: "Invalid link message", multiline: true },
    { key: "expiredHeading", label: "Expired link heading" },
    { key: "expiredMessage", label: "Expired link message", multiline: true },
    { key: "alreadyActiveHeading", label: "Already active heading" },
    { key: "alreadyActiveMessage", label: "Already active message", multiline: true },
    { key: "resendButton", label: "Resend button" },
    { key: "resendSuccessMessage", label: "Resend success message", multiline: true },
    { key: "resendFailureMessage", label: "Resend failure message", multiline: true },
    { key: "autoConfirmCaptchaText", label: "Auto activation captcha text", multiline: true },
    { key: "autoConfirmProgressText", label: "Auto activation progress text", multiline: true },
    { key: "autoActivatingLabel", label: "Auto activating label" },
    { key: "readyTitle", label: "Success page action title" },
    { key: "readyWithPasswordSubtitle", label: "Success action password subtitle", multiline: true },
    { key: "readySubtitle", label: "Success action subtitle", multiline: true },
    { key: "loginButton", label: "Success page login button" },
    { key: "backToLoginButton", label: "Back to login button" },
  ],
  mfa: [
    { key: "heading", label: "Heading" },
    { key: "submitButton", label: "Submit button" },
    { key: "resendButton", label: "Resend button", optional: true },
  ],
  accountSelector: [
    { key: "heading", label: "Heading" },
    { key: "subheading", label: "Subheading", optional: true },
    { key: "bodyText", label: "Body text", multiline: true },
  ],
};

const validText = (value: string | null | undefined, optional = false) =>
  optional && value === null
    ? true
    : typeof value === "string" && value.trim().length > 0 && value.length <= 200;

export const validateOidcUiTemplate = (template: IOidcUiTemplate) => {
  const errors: Record<string, string> = {};
  if (!template.branding.brandName.trim() || template.branding.brandName.length > 80) {
    errors["branding.brandName"] = "must be between 1 and 80 characters";
  }
  if (template.branding.logoUrl !== null) {
    try {
      const url = new URL(template.branding.logoUrl);
      if (!url.hostname || !["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      errors["branding.logoUrl"] = "must be an absolute http or https URL";
    }
  }

  (["light", "dark"] as const).forEach((mode) => {
    THEME_FIELDS.forEach(({ key, acceptsRgba }) => {
      const value = template.theme[mode][key];
      const isValid = HEX_COLOR_PATTERN.test(value) || (acceptsRgba && isRgbaColor(value));
      if (!isValid) {
        errors[`theme.${mode}.${key}`] = acceptsRgba
          ? HEX_OR_RGBA_COLOR_MESSAGE
          : HEX_COLOR_MESSAGE;
      }
    });
  });

  PAGE_OPTIONS.forEach(({ key: pageKey }) => {
    const page = template.pages[pageKey] as unknown as Record<string, string | null>;
    PAGE_FIELDS[pageKey].forEach(({ key, optional }) => {
      if (!validText(page[key], optional)) errors[`pages.${pageKey}.${key}`] = TEXT_MESSAGE;
    });
  });
  (["footerText", "helpPrompt", "supportLinkText"] as const).forEach((key) => {
    if (!validText(template.pages.shared[key])) errors[`pages.shared.${key}`] = TEXT_MESSAGE;
  });
  return errors;
};
