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
 * A tenant may have multiple captcha configurations, each identified by `id`. The backend never
 * returns the secret itself — only whether one is set (`secretId` present) — so the edit form
 * must treat the secret field as write-only, never pre-filled with a real value.
 */
export interface ICaptchaConfig {
  id: string;
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
  /** Omit to create a new configuration; supply an existing `id` to update it instead. */
  id?: string;
  provider: string;
  captchaKey: string;
  captchaGenerator: string;
  isEnable: boolean;
  /** Omit, or leave empty, to keep the previously-saved secret untouched. */
  captchaSecret?: string;
}

export interface IToggleCaptchaConfigStatusPayload {
  id: string;
  provider: string;
  captchaKey: string;
  captchaGenerator: string;
  isEnable: boolean;
}
