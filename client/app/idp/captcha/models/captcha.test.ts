import { describe, expect, it } from "vitest";
import { CAPTCHA_PROVIDERS, CAPTCHA_GENERATOR_TYPE } from "./captcha";

describe("captcha model constants", () => {
  it("exposes the supported captcha providers with labels", () => {
    expect(CAPTCHA_PROVIDERS.recaptcha).toEqual({
      value: "recaptcha",
      label: "Google reCAPTCHA",
    });
    expect(CAPTCHA_PROVIDERS.hcaptcha).toEqual({
      value: "hcaptcha",
      label: "hCAPTCHA",
    });
  });

  it("exposes the captcha generator difficulty types", () => {
    expect(CAPTCHA_GENERATOR_TYPE.EasyCaptchaGenerator.label).toBe("Easy");
    expect(CAPTCHA_GENERATOR_TYPE.HardCaptchaGenerator.label).toBe("Hard");
    expect(Object.keys(CAPTCHA_GENERATOR_TYPE)).toHaveLength(2);
  });
});
