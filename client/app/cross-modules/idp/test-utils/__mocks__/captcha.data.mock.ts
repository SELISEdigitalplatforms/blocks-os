import { TEST_PROJECT_KEY, mockSuccessResponse, mockErrorResponse } from "@/test-utils/__mocks__";
import type {
  ICaptchaConfig,
  IGetCaptchaConfigPayload,
  ISaveCaptchaConfigPayload,
  IToggleCaptchaConfigStatusPayload,
} from "../../captcha/models/captcha";

export { mockSuccessResponse, mockErrorResponse };

// ─── Captcha Mocks ───────────────────────────────────────────────────────────

export const mockCaptchaConfig: ICaptchaConfig = {
  captchaKey: "6Le-mock-captcha-key",
  provider: "recaptcha",
  captchaGenerator: "EasyCaptchaGenerator",
  isEnable: true,
  secretId: "sec-mock-1",
};

export const mockEmptyCaptchaConfigResponse = null;

export const mockGetCaptchaConfigPayload: IGetCaptchaConfigPayload = {
  projectKey: TEST_PROJECT_KEY,
};

export const mockSaveCaptchaPayload: ISaveCaptchaConfigPayload = {
  captchaKey: "6Le-new-captcha-key",
  captchaSecret: "6Le-new-captcha-secret",
  provider: "recaptcha",
  captchaGenerator: "EasyCaptchaGenerator",
  isEnable: true,
};

export const mockToggleCaptchaStatusPayload: IToggleCaptchaConfigStatusPayload = {
  captchaKey: mockCaptchaConfig.captchaKey,
  provider: mockCaptchaConfig.provider,
  captchaGenerator: mockCaptchaConfig.captchaGenerator,
  isEnable: false,
};
