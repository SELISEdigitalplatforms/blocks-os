import { tStatic } from "@seliseblocks/genesis-os";
import type {
  IOidcUiTemplate,
  IOidcUiThemePalette,
} from "@blocks-idp/authentication/models/auth.oidc.model";

const KEY_FIELD_BACK_TO_LOGIN_BUTTON = "OIDC_TEMPLATE_VALIDATION.FIELD_BACK_TO_LOGIN_BUTTON";
const KEY_FIELD_EMAIL_LABEL = "OIDC_TEMPLATE_VALIDATION.FIELD_EMAIL_LABEL";
const KEY_FIELD_HEADING = "OIDC_TEMPLATE_VALIDATION.FIELD_HEADING";
const KEY_FIELD_CREDENTIAL_LABEL = "OIDC_TEMPLATE_VALIDATION.FIELD_PASSWORD_LABEL";
const KEY_FIELD_RESEND_BUTTON = "OIDC_TEMPLATE_VALIDATION.FIELD_RESEND_BUTTON";
const KEY_FIELD_SSO_SEPARATOR = "OIDC_TEMPLATE_VALIDATION.FIELD_SSO_SEPARATOR";
const KEY_FIELD_SUBMIT_BUTTON = "OIDC_TEMPLATE_VALIDATION.FIELD_SUBMIT_BUTTON";
const KEY_FIELD_SUCCESS_SUBTITLE = "OIDC_TEMPLATE_VALIDATION.FIELD_SUCCESS_SUBTITLE";
const KEY_FIELD_SUCCESS_TITLE = "OIDC_TEMPLATE_VALIDATION.FIELD_SUCCESS_TITLE";

const I18N_MODULE = "os.idp.oidc";

export const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const RGBA_COLOR_PATTERN =
  /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*((?:\d+(?:\.\d+)?|\.\d+))\s*\)$/i;

export const getHexColorMessage = () =>
  tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.MESSAGE_HEX_COLOR");
export const getHexOrRgbaColorMessage = () =>
  tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.MESSAGE_HEX_OR_RGBA_COLOR");
export const getTextMessage = () => tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.MESSAGE_TEXT");
export const getUrlMessage = () => tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.MESSAGE_URL");

export const isAbsoluteHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return !!url.hostname && ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
};

export const isRgbaColor = (value: string) => {
  const match = value.match(RGBA_COLOR_PATTERN);
  if (!match) return false;
  const [red, green, blue, alpha] = match.slice(1).map(Number);
  return red <= 255 && green <= 255 && blue <= 255 && alpha >= 0 && alpha <= 1;
};

export const getThemeFields = (): Array<{
  key: keyof IOidcUiThemePalette;
  label: string;
  acceptsRgba: boolean;
}> => [
  {
    key: "primary",
    label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.THEME_PRIMARY"),
    acceptsRgba: false,
  },
  {
    key: "secondary",
    label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.THEME_SECONDARY"),
    acceptsRgba: false,
  },
  {
    key: "background",
    label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.THEME_BACKGROUND"),
    acceptsRgba: false,
  },
  {
    key: "surface",
    label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.THEME_SURFACE"),
    acceptsRgba: false,
  },
  {
    key: "text",
    label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.THEME_TEXT"),
    acceptsRgba: false,
  },
  {
    key: "mutedText",
    label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.THEME_MUTED_TEXT"),
    acceptsRgba: false,
  },
  {
    key: "success",
    label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.THEME_SUCCESS"),
    acceptsRgba: false,
  },
  {
    key: "danger",
    label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.THEME_DANGER"),
    acceptsRgba: false,
  },
  {
    key: "border",
    label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.THEME_BORDER"),
    acceptsRgba: true,
  },
  {
    key: "borderStrong",
    label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.THEME_STRONG_BORDER"),
    acceptsRgba: true,
  },
  {
    key: "accentSoft",
    label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.THEME_SOFT_ACCENT"),
    acceptsRgba: true,
  },
  {
    key: "buttonText",
    label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.THEME_BUTTON_TEXT"),
    acceptsRgba: false,
  },
];

export type OidcPageKey = Exclude<keyof IOidcUiTemplate["pages"], "shared">;

export const getPageOptions = (): Array<{ key: OidcPageKey; label: string }> => [
  { key: "signup", label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.PAGE_SIGNUP") },
  { key: "login", label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.PAGE_LOGIN") },
  {
    key: "forgotPassword",
    label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.PAGE_FORGOT_PASSWORD"),
  },
  {
    key: "resetPassword",
    label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.PAGE_RESET_PASSWORD"),
  },
  { key: "activation", label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.PAGE_ACTIVATION") },
  { key: "mfa", label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.PAGE_MFA") },
  {
    key: "accountSelector",
    label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.PAGE_ACCOUNT_SELECTOR"),
  },
];

type PageField = {
  key: string;
  label: string;
  optional?: boolean;
  multiline?: boolean;
  placeholder?: string;
  /** "url" swaps the 1-200 character rule for an absolute http/https URL check. */
  type?: "url";
};

export const getPageFields = (): Record<OidcPageKey, PageField[]> => ({
  login: [
    { key: "heading", label: tStatic(I18N_MODULE, KEY_FIELD_HEADING) },
    {
      key: "emailLabel",
      label: tStatic(I18N_MODULE, KEY_FIELD_EMAIL_LABEL),
    },
    {
      key: "passwordLabel",
      label: tStatic(I18N_MODULE, KEY_FIELD_CREDENTIAL_LABEL),
    },
    {
      key: "forgotPasswordLink",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_FORGOT_PASSWORD_LINK"),
    },
    {
      key: "submitButton",
      label: tStatic(I18N_MODULE, KEY_FIELD_SUBMIT_BUTTON),
    },
    {
      key: "signupPrompt",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_SIGNUP_PROMPT"),
    },
    {
      key: "signupLink",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_SIGNUP_LINK"),
    },
    // Required: blocks-iam rejects a blank separator, so the editor must not accept one.
    { key: "ssoSeparatorText", label: tStatic(I18N_MODULE, KEY_FIELD_SSO_SEPARATOR) },
    {
      key: "activationErrorTitle",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_ACTIVATION_ERROR_TITLE"),
    },
    {
      key: "activationErrorMessage",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_ACTIVATION_ERROR_MESSAGE"),
      multiline: true,
    },
    {
      key: "activateAccountButton",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_ACTIVATE_ACCOUNT_BUTTON"),
    },
    {
      key: "backToLoginButton",
      label: tStatic(I18N_MODULE, KEY_FIELD_BACK_TO_LOGIN_BUTTON),
    },
  ],
  signup: [
    { key: "heading", label: tStatic(I18N_MODULE, KEY_FIELD_HEADING) },
    {
      key: "firstNameLabel",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_FIRST_NAME_LABEL"),
    },
    {
      key: "lastNameLabel",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_LAST_NAME_LABEL"),
    },
    {
      key: "emailLabel",
      label: tStatic(I18N_MODULE, KEY_FIELD_EMAIL_LABEL),
    },
    {
      key: "organizationNameLabel",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_ORGANIZATION_NAME_LABEL"),
    },
    {
      key: "termsPrefix",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_TERMS_PREFIX"),
    },
    {
      key: "termsLinkText",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_TERMS_LINK_TEXT"),
    },
    {
      key: "termsLinkUrl",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_TERMS_LINK_URL"),
      optional: true,
      type: "url",
      placeholder: "https://example.com/terms",
    },
    {
      key: "termsConjunction",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_TERMS_CONJUNCTION"),
    },
    {
      key: "privacyLinkText",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_PRIVACY_LINK_TEXT"),
    },
    {
      key: "privacyLinkUrl",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_PRIVACY_LINK_URL"),
      optional: true,
      type: "url",
      placeholder: "https://example.com/privacy",
    },
    {
      key: "submitButton",
      label: tStatic(I18N_MODULE, KEY_FIELD_SUBMIT_BUTTON),
    },
    {
      key: "creatingButton",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_CREATING_BUTTON"),
    },
    {
      key: "loginPrompt",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_LOGIN_PROMPT"),
    },
    {
      key: "loginLink",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_LOGIN_LINK"),
    },
    { key: "ssoSeparatorText", label: tStatic(I18N_MODULE, KEY_FIELD_SSO_SEPARATOR) },
    {
      key: "successTitle",
      label: tStatic(I18N_MODULE, KEY_FIELD_SUCCESS_TITLE),
    },
    {
      key: "successSubtitle",
      label: tStatic(I18N_MODULE, KEY_FIELD_SUCCESS_SUBTITLE),
    },
    {
      key: "emailSentTitle",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_EMAIL_SENT_TITLE"),
    },
    {
      key: "emailSentSubtitle",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_EMAIL_SENT_SUBTITLE"),
      multiline: true,
    },
    {
      key: "resendPromptTitle",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_RESEND_PROMPT_TITLE"),
    },
    {
      key: "resendPromptSubtitle",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_RESEND_PROMPT_SUBTITLE"),
      multiline: true,
    },
    {
      key: "resendButton",
      label: tStatic(I18N_MODULE, KEY_FIELD_RESEND_BUTTON),
    },
    {
      key: "loginSentPrompt",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_SENT_PAGE_LOGIN_PROMPT"),
    },
    {
      key: "loginSentLink",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_SENT_PAGE_LOGIN_LINK"),
    },
  ],
  forgotPassword: [
    { key: "heading", label: tStatic(I18N_MODULE, KEY_FIELD_HEADING) },
    {
      key: "introText",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_INTRO_TEXT"),
      multiline: true,
    },
    {
      key: "emailLabel",
      label: tStatic(I18N_MODULE, KEY_FIELD_EMAIL_LABEL),
    },
    {
      key: "submitButton",
      label: tStatic(I18N_MODULE, KEY_FIELD_SUBMIT_BUTTON),
    },
    {
      key: "backToLoginButton",
      label: tStatic(I18N_MODULE, KEY_FIELD_BACK_TO_LOGIN_BUTTON),
    },
    {
      key: "successTitle",
      label: tStatic(I18N_MODULE, KEY_FIELD_SUCCESS_TITLE),
    },
    {
      key: "successSubtitle",
      label: tStatic(I18N_MODULE, KEY_FIELD_SUCCESS_SUBTITLE),
      multiline: true,
    },
    {
      key: "resendPromptTitle",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_RESEND_PROMPT_TITLE"),
    },
    {
      key: "resendPromptSubtitle",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_RESEND_PROMPT_SUBTITLE"),
      multiline: true,
    },
    {
      key: "resendButton",
      label: tStatic(I18N_MODULE, KEY_FIELD_RESEND_BUTTON),
    },
    {
      key: "loginPrompt",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_LOGIN_PROMPT"),
    },
    {
      key: "loginLink",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_LOGIN_LINK"),
    },
  ],
  resetPassword: [
    { key: "heading", label: tStatic(I18N_MODULE, KEY_FIELD_HEADING) },
    {
      key: "passwordLabel",
      label: tStatic(I18N_MODULE, KEY_FIELD_CREDENTIAL_LABEL),
    },
    {
      key: "confirmPasswordLabel",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_CONFIRM_PASSWORD_LABEL"),
    },
    {
      key: "logoutFromDevicesLabel",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_LOGOUT_FROM_DEVICES_LABEL"),
    },
    {
      key: "submitButton",
      label: tStatic(I18N_MODULE, KEY_FIELD_SUBMIT_BUTTON),
    },
    {
      key: "resettingButton",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_RESETTING_BUTTON"),
    },
    {
      key: "missingCodeMessage",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_MISSING_CODE_MESSAGE"),
      multiline: true,
    },
    {
      key: "requestNewLinkButton",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_REQUEST_NEW_LINK_BUTTON"),
    },
    {
      key: "backToLoginButton",
      label: tStatic(I18N_MODULE, KEY_FIELD_BACK_TO_LOGIN_BUTTON),
    },
    {
      key: "successTitle",
      label: tStatic(I18N_MODULE, KEY_FIELD_SUCCESS_TITLE),
    },
    {
      key: "successSubtitle",
      label: tStatic(I18N_MODULE, KEY_FIELD_SUCCESS_SUBTITLE),
    },
    {
      key: "readyTitle",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_SUCCESS_PAGE_ACTION_TITLE"),
    },
    {
      key: "readySubtitle",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_SUCCESS_PAGE_ACTION_SUBTITLE"),
      multiline: true,
    },
    {
      key: "loginButton",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_SUCCESS_PAGE_LOGIN_BUTTON"),
    },
  ],
  activation: [
    { key: "heading", label: tStatic(I18N_MODULE, KEY_FIELD_HEADING) },
    {
      key: "firstNameLabel",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_FIRST_NAME_LABEL"),
    },
    {
      key: "lastNameLabel",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_LAST_NAME_LABEL"),
    },
    {
      key: "passwordLabel",
      label: tStatic(I18N_MODULE, KEY_FIELD_CREDENTIAL_LABEL),
    },
    {
      key: "confirmPasswordLabel",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_CONFIRM_PASSWORD_LABEL"),
    },
    {
      key: "submitButton",
      label: tStatic(I18N_MODULE, KEY_FIELD_SUBMIT_BUTTON),
    },
    {
      key: "activatingButton",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_ACTIVATING_BUTTON"),
    },
    {
      key: "successTitle",
      label: tStatic(I18N_MODULE, KEY_FIELD_SUCCESS_TITLE),
    },
    {
      key: "successSubtitle",
      label: tStatic(I18N_MODULE, KEY_FIELD_SUCCESS_SUBTITLE),
    },
    {
      key: "invalidHeading",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_INVALID_LINK_HEADING"),
    },
    {
      key: "invalidMessage",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_INVALID_LINK_MESSAGE"),
      multiline: true,
    },
    {
      key: "expiredHeading",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_EXPIRED_LINK_HEADING"),
    },
    {
      key: "expiredMessage",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_EXPIRED_LINK_MESSAGE"),
      multiline: true,
    },
    {
      key: "alreadyActiveHeading",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_ALREADY_ACTIVE_HEADING"),
    },
    {
      key: "alreadyActiveMessage",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_ALREADY_ACTIVE_MESSAGE"),
      multiline: true,
    },
    {
      key: "resendButton",
      label: tStatic(I18N_MODULE, KEY_FIELD_RESEND_BUTTON),
    },
    {
      key: "resendSuccessMessage",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_RESEND_SUCCESS_MESSAGE"),
      multiline: true,
    },
    {
      key: "resendFailureMessage",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_RESEND_FAILURE_MESSAGE"),
      multiline: true,
    },
    {
      key: "autoConfirmCaptchaText",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_AUTO_ACTIVATION_CAPTCHA_TEXT"),
      multiline: true,
    },
    {
      key: "autoConfirmProgressText",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_AUTO_ACTIVATION_PROGRESS_TEXT"),
      multiline: true,
    },
    {
      key: "autoActivatingLabel",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_AUTO_ACTIVATING_LABEL"),
    },
    {
      key: "readyTitle",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_SUCCESS_PAGE_ACTION_TITLE"),
    },
    {
      key: "readyWithPasswordSubtitle",
      label: tStatic(
        I18N_MODULE,
        "OIDC_TEMPLATE_VALIDATION.FIELD_SUCCESS_ACTION_PASSWORD_SUBTITLE",
      ),
      multiline: true,
    },
    {
      key: "readySubtitle",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_SUCCESS_ACTION_SUBTITLE"),
      multiline: true,
    },
    {
      key: "loginButton",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_SUCCESS_PAGE_LOGIN_BUTTON"),
    },
    {
      key: "backToLoginButton",
      label: tStatic(I18N_MODULE, KEY_FIELD_BACK_TO_LOGIN_BUTTON),
    },
  ],
  mfa: [
    { key: "heading", label: tStatic(I18N_MODULE, KEY_FIELD_HEADING) },
    {
      key: "submitButton",
      label: tStatic(I18N_MODULE, KEY_FIELD_SUBMIT_BUTTON),
    },
    {
      key: "resendButton",
      label: tStatic(I18N_MODULE, KEY_FIELD_RESEND_BUTTON),
      optional: true,
    },
  ],
  accountSelector: [
    { key: "heading", label: tStatic(I18N_MODULE, KEY_FIELD_HEADING) },
    {
      key: "subheading",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_SUBHEADING"),
      optional: true,
    },
    {
      key: "bodyText",
      label: tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.FIELD_BODY_TEXT"),
      multiline: true,
    },
  ],
});

const validText = (value: string | null | undefined, optional = false) =>
  optional && value === null
    ? true
    : typeof value === "string" && value.trim().length > 0 && value.length <= 200;

export const validateOidcUiTemplate = (template: IOidcUiTemplate) => {
  const errors: Record<string, string> = {};
  if (!template.branding.brandName.trim() || template.branding.brandName.length > 80) {
    errors["branding.brandName"] = tStatic(
      I18N_MODULE,
      "OIDC_TEMPLATE_VALIDATION.MESSAGE_BRAND_NAME",
    );
  }
  (["logoUrlLight", "logoUrlDark"] as const).forEach((field) => {
    const value = template.branding[field];
    if (value === null) return;
    if (!isAbsoluteHttpUrl(value)) errors[`branding.${field}`] = getUrlMessage();
  });

  (["light", "dark"] as const).forEach((mode) => {
    getThemeFields().forEach(({ key, acceptsRgba }) => {
      const value = template.theme[mode][key];
      const isValid = HEX_COLOR_PATTERN.test(value) || (acceptsRgba && isRgbaColor(value));
      if (!isValid) {
        errors[`theme.${mode}.${key}`] = acceptsRgba
          ? getHexOrRgbaColorMessage()
          : getHexColorMessage();
      }
    });
  });

  getPageOptions().forEach(({ key: pageKey }) => {
    const page = template.pages[pageKey] as unknown as Record<string, string | null>;
    getPageFields()[pageKey].forEach(({ key, optional, type }) => {
      const value = page[key];
      if (type === "url") {
        if (optional && value === null) return;
        if (typeof value !== "string" || !isAbsoluteHttpUrl(value)) {
          errors[`pages.${pageKey}.${key}`] = getUrlMessage();
        }
        return;
      }
      if (!validText(value, optional)) errors[`pages.${pageKey}.${key}`] = getTextMessage();
    });
  });
  (["footerText", "helpPrompt", "supportLinkText"] as const).forEach((key) => {
    if (!validText(template.pages.shared[key])) errors[`pages.shared.${key}`] = getTextMessage();
  });
  return errors;
};

/** Compares an error key by its letters only, so "Pages.Signup.Heading" matches "pages.signup.heading". */
export const normalizeTemplateErrorKey = (key: string) => key.toLowerCase().replace(/[^a-z]/g, "");

const inSection = (section: string, field: string) =>
  tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.ERROR_FIELD_IN_SECTION", { section, field });

const getTemplateErrorLabels = (): Map<string, string> => {
  const labels = new Map<string, string>();
  const add = (path: string, label: string) => labels.set(normalizeTemplateErrorKey(path), label);

  add("branding.brandName", tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.BRAND_NAME"));
  add("branding.logoUrlLight", tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.LOGO_LIGHT"));
  add("branding.logoUrlDark", tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.LOGO_DARK"));

  const modes = [
    ["light", tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.LIGHT")],
    ["dark", tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.DARK")],
  ] as const;
  const themeFields = getThemeFields();
  modes.forEach(([mode, modeLabel]) => {
    add(`theme.${mode}`, modeLabel);
    themeFields.forEach(({ key, label }) =>
      add(`theme.${mode}.${key}`, inSection(modeLabel, label)),
    );
  });

  const pageFields = getPageFields();
  getPageOptions().forEach(({ key: pageKey, label: pageLabel }) => {
    add(`pages.${pageKey}`, pageLabel);
    pageFields[pageKey].forEach(({ key, label }) =>
      add(`pages.${pageKey}.${key}`, inSection(pageLabel, label)),
    );
  });

  add("pages.shared.footerText", tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.FOOTER"));
  add("pages.shared.helpPrompt", tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.SHARED_HELP_PROMPT"));
  add(
    "pages.shared.supportLinkText",
    tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.SHARED_SUPPORT_LINK_TEXT"),
  );
  return labels;
};

/**
 * Names the field in front of each blocks-iam save error. IAM keys its errors by property
 * path ("Pages.Signup.EmailSentSubtitle") and its messages carry no field name, so without
 * this a rejected template reads as a list of identical "must be between..." lines. A key
 * with no known field (e.g. "Template") keeps its value untouched.
 */
export const labelOidcTemplateErrors = (
  errors: Record<string, string | string[]>,
): Record<string, string | string[]> => {
  const labels = getTemplateErrorLabels();
  return Object.fromEntries(
    Object.entries(errors).map(([key, value]) => {
      const field = labels.get(normalizeTemplateErrorKey(key));
      if (!field) return [key, value];
      const error = Array.isArray(value) ? value.join(", ") : value;
      return [key, tStatic(I18N_MODULE, "OIDC_TEMPLATE_VALIDATION.SERVER_ERROR", { field, error })];
    }),
  );
};
