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
  id: "captcha-mock-1",
  captchaKey: "6Le-mock-captcha-key",
  provider: "recaptcha",
  captchaGenerator: "EasyCaptchaGenerator",
  isEnable: true,
  secretId: "sec-mock-1",
};

export const mockSecondCaptchaConfig: ICaptchaConfig = {
  id: "captcha-mock-2",
  captchaKey: "6Le-mock-captcha-key-2",
  provider: "hcaptcha",
  captchaGenerator: "HardCaptchaGenerator",
  isEnable: false,
  secretId: null,
};

export const mockCaptchaConfigList: ICaptchaConfig[] = [mockCaptchaConfig, mockSecondCaptchaConfig];

export const mockEmptyCaptchaConfigResponse = null;

export const mockEmptyCaptchaConfigListResponse: ICaptchaConfig[] = [];

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

export const mockUpdateCaptchaPayload: ISaveCaptchaConfigPayload = {
  id: mockCaptchaConfig.id,
  captchaKey: "6Le-updated-captcha-key",
  provider: "recaptcha",
  captchaGenerator: "EasyCaptchaGenerator",
  isEnable: true,
};

export const mockToggleCaptchaStatusPayload: IToggleCaptchaConfigStatusPayload = {
  id: mockCaptchaConfig.id,
  captchaKey: mockCaptchaConfig.captchaKey,
  provider: mockCaptchaConfig.provider,
  captchaGenerator: mockCaptchaConfig.captchaGenerator,
  isEnable: false,
};
