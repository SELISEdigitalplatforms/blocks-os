import { http } from "@/lib/http-client";
import { secretsService } from "@/services/secrets.service";
import {
  ICaptchaSecretResponse,
  IEnableCaptchaConfigsStatusPayload,
  IEnableCaptchaConfigsStatusResponse,
  IGetCaptchaConfigsPayload,
  IGetCaptchaConfigsResponse,
  ISaveCaptchaConfigsPayload,
  ISaveCaptchaConfigsResponse,
} from "@blocks-idp/captcha/models/captcha";
import { CAPTCHA_ENDPOINTS } from "../constants/endpoint.constant";

export class CaptchaService {
  getCaptchaConfigs(payload: IGetCaptchaConfigsPayload): Promise<IGetCaptchaConfigsResponse> {
    return http
      .get<ICaptchaSecretResponse[]>(
        `${CAPTCHA_ENDPOINTS.GETS}?secretKey=captcha`,
      )
      .then((secrets) => {
        const secret = secrets?.[0];
        if (!secret) return { configurations: [] };
        const kv = secret.keyValuePairs;
        return {
          configurations: [
            {
              itemId: kv.itemId || secret.itemId,
              createdDate: secret.createdDate,
              lastUpdatedDate: secret.lastUpdatedDate,
              createdBy: secret.createdBy,
              lastUpdatedBy: secret.lastUpdatedBy,
              organizationIds: secret.organizationIds,
              tags: secret.tags,
              captchaKey: kv.captchaKey,
              captchaSecret: kv.captchaSecret,
              provider: kv.provider as IGetCaptchaConfigsResponse["configurations"][0]["provider"],
              captchaGenerator: kv.captchaGenerator as IGetCaptchaConfigsResponse["configurations"][0]["captchaGenerator"],
              isEnable: typeof kv.isEnable === "string" ? kv.isEnable === "true" : Boolean(kv.isEnable),
            },
          ],
        };
      });
  }

  saveCaptcha = (payload: ISaveCaptchaConfigsPayload): Promise<ISaveCaptchaConfigsResponse> => {
    return secretsService
      .save({
        secretKey: "captcha",
        keyValuePairs: {
          isEnable: String(payload.isEnable),
          provider: payload.provider,
          captchaKey: payload.captchaKey,
          captchaSecret: payload.captchaSecret,
          captchaGenerator: payload.captchaGenerator,
        },
      })
      .then((item) => ({ isSuccess: true, errors: null, itemId: item.itemId }));
  };

  updateCaptchaConfigStatus = (
    payload: IEnableCaptchaConfigsStatusPayload,
  ): Promise<IEnableCaptchaConfigsStatusResponse> => {
    return secretsService
      .save({
        secretKey: "captcha",
        keyValuePairs: {
          isEnable: String(payload.isEnable),
        },
        projectKey: payload.projectKey,
        itemId: payload.itemId,
      })
      .then((item) => ({ isSuccess: true, errors: null, itemId: item.itemId }));
  };
}

export const captchaService = new CaptchaService();
