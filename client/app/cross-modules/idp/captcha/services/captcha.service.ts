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
   * Reads one captcha configuration by id. Resolves to null rather than rejecting when it does
   * not exist — the backend answers that case with a 404, which is a normal state here, not a
   * failure.
   */
  getCaptchaConfig(id: string): Promise<ICaptchaConfig | null> {
    return http.get<ICaptchaConfig>(CAPTCHA_ENDPOINTS.GET(id)).catch((error) => {
      if (isHttpErrorStatus(error, 404)) return null;
      throw error;
    });
  }

  /** Reads every captcha configuration belonging to the tenant. */
  getCaptchaConfigList = (): Promise<ICaptchaConfig[]> => {
    return http.get<ICaptchaConfig[]>(CAPTCHA_ENDPOINTS.LIST);
  };

  /**
   * Creates a new captcha configuration, or updates the one identified by `payload.id` when
   * supplied. `captchaSecret` may be omitted (or left empty) to leave a previously-set secret
   * untouched.
   */
  saveCaptcha = (payload: ISaveCaptchaConfigPayload): Promise<ICaptchaConfig> => {
    return http.post<ICaptchaConfig>(CAPTCHA_ENDPOINTS.SAVE, payload);
  };

  /** Flips `isEnable` on the configuration identified by `payload.id`, without touching its stored secret. */
  updateCaptchaConfigStatus = (
    payload: IToggleCaptchaConfigStatusPayload,
  ): Promise<ICaptchaConfig> => {
    return http.post<ICaptchaConfig>(CAPTCHA_ENDPOINTS.SAVE, payload);
  };

  deleteCaptchaConfig = (id: string): Promise<void> => {
    return http.delete<void>(CAPTCHA_ENDPOINTS.DELETE(id));
  };
}

export const captchaService = new CaptchaService();
