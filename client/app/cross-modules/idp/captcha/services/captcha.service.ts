import { http } from "@/lib/http/http-client";
import { isHttpErrorStatus } from "@/lib/http/http-error.util";
import {
  ICaptchaConfig,
  ISaveCaptchaConfigPayload,
  IToggleCaptchaConfigStatusPayload,
} from "@blocks-idp/captcha/models/captcha";
import { CAPTCHA_ENDPOINTS } from "../constants/endpoint.constant";

export class CaptchaService {
  /**
   * Reads the tenant's captcha configuration. Resolves to null rather than rejecting when
   * nothing has been configured yet — the backend answers that case with a 404, which is a
   * normal state here, not a failure.
   */
  getCaptchaConfig(): Promise<ICaptchaConfig | null> {
    return http.get<ICaptchaConfig>(CAPTCHA_ENDPOINTS.GET).catch((error) => {
      if (isHttpErrorStatus(error, 404)) return null;
      throw error;
    });
  }

  /**
   * Creates or updates the captcha configuration. `captchaSecret` may be omitted (or left
   * empty) to leave a previously-set secret untouched.
   */
  saveCaptcha = (payload: ISaveCaptchaConfigPayload): Promise<ICaptchaConfig> => {
    return http.post<ICaptchaConfig>(CAPTCHA_ENDPOINTS.SAVE, payload);
  };

  /** Flips `isEnable` without touching the stored secret. */
  updateCaptchaConfigStatus = (
    payload: IToggleCaptchaConfigStatusPayload,
  ): Promise<ICaptchaConfig> => {
    return http.post<ICaptchaConfig>(CAPTCHA_ENDPOINTS.SAVE, payload);
  };

  deleteCaptchaConfig = (): Promise<void> => {
    return http.delete<void>(CAPTCHA_ENDPOINTS.DELETE);
  };
}

export const captchaService = new CaptchaService();
