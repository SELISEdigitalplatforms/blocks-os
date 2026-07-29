import { http } from "@/lib/http/http-client";
import { secretsService } from "@/services/secrets.service";
import type { IAPIResponse } from "@/models/api-response";
import {
  ICaptchaSecretResponse,
  IEnableCaptchaConfigsStatusPayload,
  IEnableCaptchaConfigsStatusResponse,
  IGetCaptchaConfigsResponse,
  ISaveCaptchaConfigsPayload,
  ISaveCaptchaConfigsResponse,
} from "@blocks-idp/captcha/models/captcha";
import { CAPTCHA_ENDPOINTS } from "../constants/endpoint.constant";

export class CaptchaService {
  // The captcha secrets are fetched with a fixed query (secretKey=captcha, first page); nothing
  // from the caller is sent, so this takes no arguments. Project scoping happens via the
  // X-Blocks-Key header, and the hook gates the request on a selected project.
  getCaptchaConfigs(): Promise<IGetCaptchaConfigsResponse> {
    return http
      .get<ICaptchaSecretResponse[] | IAPIResponse<ICaptchaSecretResponse[]>>(
        `${CAPTCHA_ENDPOINTS.GETS}?secretKey=captcha&PageNumber=0&PageSize=10`,
      )
      .then((response) => {
        const secrets = Array.isArray(response) ? response : (response.data ?? []);
        if (!secrets?.length) return { configurations: [] };
        return {
          configurations: secrets.map((secret) => {
            const kv = secret.keyValuePairs;
            return {
              itemId: secret.itemId,
              createdDate: secret.createdDate,
              lastUpdatedDate: secret.lastUpdatedDate,
              createdBy: secret.createdBy,
              lastUpdatedBy: secret.lastUpdatedBy,
              organizationIds: secret.organizationIds,
              tags: secret.tags,
              captchaKey: kv.captchaKey,
              captchaSecret: kv.captchaSecret,
              provider: kv.provider as IGetCaptchaConfigsResponse["configurations"][0]["provider"],
              captchaGenerator:
                kv.captchaGenerator as IGetCaptchaConfigsResponse["configurations"][0]["captchaGenerator"],
              isEnable:
                typeof kv.isEnable === "string" ? kv.isEnable === "true" : Boolean(kv.isEnable),
            };
          }),
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
        ...(payload.itemId ? { itemId: payload.itemId } : {}),
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
          provider: payload.provider,
          captchaKey: payload.captchaKey,
          captchaSecret: payload.captchaSecret,
          captchaGenerator: payload.captchaGenerator,
        },
        itemId: payload.itemId,
      })
      .then((item) => ({ isSuccess: true, errors: null, itemId: item.itemId }));
  };
}

export const captchaService = new CaptchaService();
