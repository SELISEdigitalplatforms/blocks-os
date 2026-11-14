import { describe, expect, it } from "vitest";
import { DEFAULT_OIDC_UI_TEMPLATE } from "./oidc-template-defaults";
import {
  getHexColorMessage,
  getHexOrRgbaColorMessage,
  getPageFields,
  getPageOptions,
  getTextMessage,
  getThemeFields,
  getUrlMessage,
  isRgbaColor,
  labelOidcTemplateErrors,
  normalizeTemplateErrorKey,
  validateOidcUiTemplate,
} from "./oidc-template-validation";

const template = () => structuredClone(DEFAULT_OIDC_UI_TEMPLATE);

describe("validateOidcUiTemplate", () => {
  it("accepts the complete compiled-in template", () => {
    expect(validateOidcUiTemplate(template())).toEqual({});
  });

  it.each(["light", "dark"] as const)(
    "requires and validates every color in the %s palette independently",
    (mode) => {
      for (const { key, acceptsRgba } of getThemeFields()) {
        const draft = template();
        draft.theme[mode][key] = "";
        expect(validateOidcUiTemplate(draft)[`theme.${mode}.${key}`]).toBe(
          acceptsRgba ? getHexOrRgbaColorMessage() : getHexColorMessage(),
        );
      }
    },
  );

  it("allows rgba only for border, strong border, and soft accent", () => {
    for (const key of ["border", "borderStrong", "accentSoft"] as const) {
      const draft = template();
      draft.theme.light[key] = "rgba(12, 34, 255, .45)";
      expect(validateOidcUiTemplate(draft)[`theme.light.${key}`]).toBeUndefined();
    }

    const draft = template();
    draft.theme.light.primary = "rgba(0, 0, 0, 1)";
    expect(validateOidcUiTemplate(draft)["theme.light.primary"]).toBe(getHexColorMessage());
  });

  it.each([
    "rgba(256, 0, 0, 1)",
    "rgba(0, 256, 0, 1)",
    "rgba(0, 0, 256, 1)",
    "rgba(0, 0, 0, 1.1)",
    "rgb(0, 0, 0)",
    "rgba(nope)",
  ])("rejects malformed or out-of-range rgba value %s", (value) => {
    expect(isRgbaColor(value)).toBe(false);
  });

  it("requires the SSO separator on both pages that offer SSO, as blocks-iam does", () => {
    for (const pageKey of ["login", "signup"] as const) {
      const field = getPageFields()[pageKey].find(({ key }) => key === "ssoSeparatorText");
      expect(field?.optional).toBeUndefined();
      // No grey "or" hint: on an empty required field it read as a filled-in value.
      expect(field?.placeholder).toBeUndefined();
      expect(DEFAULT_OIDC_UI_TEMPLATE.pages[pageKey].ssoSeparatorText).toBe("or");
    }
  });

  it.each([null, "", " ", "  ", "x".repeat(201)])(
    "rejects %j as an SSO separator - blocks-iam would refuse the save",
    (value) => {
      for (const pageKey of ["login", "signup"] as const) {
        const draft = template();
        draft.pages[pageKey].ssoSeparatorText = value;
        expect(validateOidcUiTemplate(draft)[`pages.${pageKey}.ssoSeparatorText`]).toBe(
          getTextMessage(),
        );
      }
    },
  );

  it.each(["or", "OR", "x".repeat(200)])("accepts %j as an SSO separator", (value) => {
    for (const pageKey of ["login", "signup"] as const) {
      const draft = template();
      draft.pages[pageKey].ssoSeparatorText = value;
      expect(validateOidcUiTemplate(draft)).toEqual({});
    }
  });

  it("lets a tenant point the consent links at its own terms and privacy pages", () => {
    const draft = template();
    draft.pages.signup.termsLinkUrl = "https://acme.example/legal/terms";
    draft.pages.signup.privacyLinkUrl = "https://acme.example/legal/privacy";
    expect(validateOidcUiTemplate(draft)).toEqual({});

    // Unset falls back to the Blocks default on the real page, so null is allowed.
    draft.pages.signup.termsLinkUrl = null;
    draft.pages.signup.privacyLinkUrl = null;
    expect(validateOidcUiTemplate(draft)).toEqual({});
  });

  it("rejects consent link targets that aren't absolute http(s) URLs", () => {
    const draft = template();
    draft.pages.signup.termsLinkUrl = "/legal/terms";
    draft.pages.signup.privacyLinkUrl = "javascript:alert(1)";
    expect(validateOidcUiTemplate(draft)).toMatchObject({
      "pages.signup.termsLinkUrl": getUrlMessage(),
      "pages.signup.privacyLinkUrl": getUrlMessage(),
    });
  });

  it("requires every page field except the nullable copy fields", () => {
    for (const { key: pageKey } of getPageOptions()) {
      for (const { key, optional } of getPageFields()[pageKey]) {
        const draft = template();
        const page = draft.pages[pageKey] as unknown as Record<string, string | null>;
        page[key] = optional ? null : "";
        const error = validateOidcUiTemplate(draft)[`pages.${pageKey}.${key}`];
        expect(error).toBe(optional ? undefined : getTextMessage());
      }
    }
  });

  it("orders signup consent fields before the submit-button field", () => {
    const keys = getPageFields().signup.map(({ key }) => key);
    expect(keys.indexOf("termsPrefix")).toBeLessThan(keys.indexOf("submitButton"));
    expect(keys.indexOf("privacyLinkText")).toBeLessThan(keys.indexOf("submitButton"));
  });

  it("enforces the 200-character page and shared-footer limit", () => {
    const draft = template();
    draft.pages.signup.heading = "x".repeat(201);
    draft.pages.shared.footerText = "x".repeat(201);
    const errors = validateOidcUiTemplate(draft);
    expect(errors["pages.signup.heading"]).toBe(getTextMessage());
    expect(errors["pages.shared.footerText"]).toBe(getTextMessage());
  });

  it("enforces brand-name and optional-logo rules for both light and dark independently", () => {
    const invalid = template();
    invalid.branding.brandName = "x".repeat(81);
    invalid.branding.logoUrlLight = "/relative.png";
    invalid.branding.logoUrlDark = "/also-relative.png";
    expect(validateOidcUiTemplate(invalid)).toMatchObject({
      "branding.brandName": "must be between 1 and 80 characters",
      "branding.logoUrlLight": "must be an absolute http or https URL",
      "branding.logoUrlDark": "must be an absolute http or https URL",
    });

    const valid = template();
    valid.branding.logoUrlLight = null;
    valid.branding.logoUrlDark = null;
    expect(validateOidcUiTemplate(valid)).toEqual({});
    valid.branding.logoUrlLight = "https://cdn.example.com/logo.svg";
    expect(validateOidcUiTemplate(valid)).toEqual({});
    valid.branding.logoUrlDark = "https://cdn.example.com/logo-dark.svg";
    expect(validateOidcUiTemplate(valid)).toEqual({});
  });

  it("rejects only the invalid logo slot, leaving a valid sibling slot untouched", () => {
    const draft = template();
    draft.branding.logoUrlLight = "https://cdn.example.com/logo.svg";
    draft.branding.logoUrlDark = "/relative.png";
    const errors = validateOidcUiTemplate(draft);
    expect(errors["branding.logoUrlLight"]).toBeUndefined();
    expect(errors["branding.logoUrlDark"]).toBe("must be an absolute http or https URL");
  });
});

describe("labelOidcTemplateErrors", () => {
  it("names the page and field in front of each blocks-iam error, keyed as IAM sends them", () => {
    expect(
      labelOidcTemplateErrors({
        "Pages.Signup.EmailSentSubtitle": "must be between 1 and 500 characters",
        "Pages.Login.SsoSeparatorText": "must be between 1 and 200 characters",
        "Pages.Shared.HelpPrompt": "must be between 1 and 200 characters",
        "Branding.BrandName": "must be between 1 and 80 characters",
        "Theme.Dark.BorderStrong": "must be a valid hex color",
        "Pages.Activation": "is required",
      }),
    ).toEqual({
      "Pages.Signup.EmailSentSubtitle":
        "Signup · Email sent subtitle: must be between 1 and 500 characters",
      "Pages.Login.SsoSeparatorText": "Login · SSO separator: must be between 1 and 200 characters",
      "Pages.Shared.HelpPrompt": "Help prompt: must be between 1 and 200 characters",
      "Branding.BrandName": "Brand name: must be between 1 and 80 characters",
      "Theme.Dark.BorderStrong": "Dark · Strong border: must be a valid hex color",
      "Pages.Activation": "Activation: is required",
    });
  });

  it("joins a field's message list and leaves keys it cannot place untouched", () => {
    expect(
      labelOidcTemplateErrors({
        "pages.mfa.heading": ["first", "second"],
        Template: "Failed to save OIDC UI template.",
        Reasons: ["CODE_A", "CODE_B"],
      }),
    ).toEqual({
      "pages.mfa.heading": "MFA · Heading: first, second",
      Template: "Failed to save OIDC UI template.",
      Reasons: ["CODE_A", "CODE_B"],
    });
  });

  it("labels every field the editor validates", () => {
    const draft = template();
    for (const { key: pageKey } of getPageOptions()) {
      const page = draft.pages[pageKey] as unknown as Record<string, string | null>;
      for (const { key } of getPageFields()[pageKey]) page[key] = "x".repeat(501);
    }
    for (const mode of ["light", "dark"] as const) {
      for (const { key } of getThemeFields()) draft.theme[mode][key] = "nope";
    }
    draft.pages.shared.footerText = "";
    draft.pages.shared.helpPrompt = "";
    draft.pages.shared.supportLinkText = "";
    draft.branding.brandName = "";
    draft.branding.logoUrlLight = "/relative.png";
    draft.branding.logoUrlDark = "/relative.png";

    const errors = validateOidcUiTemplate(draft);
    const labelled = labelOidcTemplateErrors(errors);
    expect(Object.keys(errors).length).toBeGreaterThan(100);
    for (const [key, message] of Object.entries(errors)) {
      const text = String(labelled[key]);
      expect(text, key).not.toBe(message);
      expect(text.endsWith(`: ${message}`), key).toBe(true);
    }
  });

  it("matches keys on their letters only, whatever the casing or separators", () => {
    expect(normalizeTemplateErrorKey("Pages.Signup.EmailSentSubtitle")).toBe(
      normalizeTemplateErrorKey("pages.signup.emailSentSubtitle"),
    );
  });
});
