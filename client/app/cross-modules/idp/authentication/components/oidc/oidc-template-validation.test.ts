import { describe, expect, it } from "vitest";
import { DEFAULT_OIDC_UI_TEMPLATE } from "./oidc-template-defaults";
import {
  HEX_COLOR_MESSAGE,
  HEX_OR_RGBA_COLOR_MESSAGE,
  PAGE_FIELDS,
  PAGE_OPTIONS,
  TEXT_MESSAGE,
  THEME_FIELDS,
  isRgbaColor,
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
      for (const { key, acceptsRgba } of THEME_FIELDS) {
        const draft = template();
        draft.theme[mode][key] = "";
        expect(validateOidcUiTemplate(draft)[`theme.${mode}.${key}`]).toBe(
          acceptsRgba ? HEX_OR_RGBA_COLOR_MESSAGE : HEX_COLOR_MESSAGE,
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
    expect(validateOidcUiTemplate(draft)["theme.light.primary"]).toBe(HEX_COLOR_MESSAGE);
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

  it("requires every page field except the two nullable copy fields", () => {
    for (const { key: pageKey } of PAGE_OPTIONS) {
      for (const { key, optional } of PAGE_FIELDS[pageKey]) {
        const draft = template();
        const page = draft.pages[pageKey] as unknown as Record<string, string | null>;
        page[key] = optional ? null : "";
        const error = validateOidcUiTemplate(draft)[`pages.${pageKey}.${key}`];
        expect(error).toBe(optional ? undefined : TEXT_MESSAGE);
      }
    }
  });

  it("orders signup consent fields before the submit-button field", () => {
    const keys = PAGE_FIELDS.signup.map(({ key }) => key);
    expect(keys.indexOf("termsPrefix")).toBeLessThan(keys.indexOf("submitButton"));
    expect(keys.indexOf("privacyLinkText")).toBeLessThan(keys.indexOf("submitButton"));
  });

  it("enforces the 200-character page and shared-footer limit", () => {
    const draft = template();
    draft.pages.signup.heading = "x".repeat(201);
    draft.pages.shared.footerText = "x".repeat(201);
    const errors = validateOidcUiTemplate(draft);
    expect(errors["pages.signup.heading"]).toBe(TEXT_MESSAGE);
    expect(errors["pages.shared.footerText"]).toBe(TEXT_MESSAGE);
  });

  it("enforces brand-name and optional-logo rules", () => {
    const invalid = template();
    invalid.branding.brandName = "x".repeat(81);
    invalid.branding.logoUrl = "/relative.png";
    expect(validateOidcUiTemplate(invalid)).toMatchObject({
      "branding.brandName": "must be between 1 and 80 characters",
      "branding.logoUrl": "must be an absolute http or https URL",
    });

    const valid = template();
    valid.branding.logoUrl = null;
    expect(validateOidcUiTemplate(valid)).toEqual({});
    valid.branding.logoUrl = "https://cdn.example.com/logo.svg";
    expect(validateOidcUiTemplate(valid)).toEqual({});
  });
});
