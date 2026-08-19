export const CAPTCHA_PROVIDERS = {
  recaptcha: { value: "recaptcha", label: "Google reCAPTCHA" },
  hcaptcha: { value: "hcaptcha", label: "hCAPTCHA" },
} as const;
export const CAPTCHA_GENERATOR_TYPE = {
  EasyCaptchaGenerator: { value: "EasyCaptchaGenerator", label: "Easy" },
  HardCaptchaGenerator: { value: "HardCaptchaGenerator", label: "Hard" },
} as const;

export type CAPTCHA_PROVIDERS_KEY = keyof typeof CAPTCHA_PROVIDERS;

/**
 * There is exactly one captcha configuration per tenant. The backend never returns the secret
 * itself — only whether one is set (`secretId` present) — so the edit form must treat the
 * secret field as write-only, never pre-filled with a real value.
 */
export interface ICaptchaConfig {
  provider: CAPTCHA_PROVIDERS_KEY;
  captchaKey: string;
  captchaGenerator: keyof typeof CAPTCHA_GENERATOR_TYPE;
  isEnable: boolean;
  secretId: string | null;
}

export interface IGetCaptchaConfigPayload {
  projectKey: string;
}

export interface ISaveCaptchaConfigPayload {
  provider: string;
  captchaKey: string;
  captchaGenerator: string;
  isEnable: boolean;
  /** Omit, or leave empty, to keep the previously-saved secret untouched. */
  captchaSecret?: string;
}

export interface IToggleCaptchaConfigStatusPayload {
  provider: string;
  captchaKey: string;
  captchaGenerator: string;
  isEnable: boolean;
}
