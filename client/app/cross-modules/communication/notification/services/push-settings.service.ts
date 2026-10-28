import { http } from "@/lib/http/http-client";
import type { IAPIResponse } from "@/models/api-response";
import { PUSH_SETTINGS_ENDPOINTS } from "../constants/endpoint.constant";
import type {
  IPushSettings,
  IPushSettingsAck,
  ISavePushSettingsPayload,
} from "../models/notification-config.model";

const ABSOLUTE = { absoluteUrl: true } as const;

const NOT_SET_UP: IPushSettings = { projectId: null, enabled: false, hasKey: false };

/** The endpoint answers either wrapped in `data` or as the bare settings. */
const toSettings = (response: IPushSettings | IAPIResponse<IPushSettings>): IPushSettings => {
  const wrapped = (response as IAPIResponse<IPushSettings>)?.data;
  const bare = wrapped && !Array.isArray(wrapped) ? wrapped : (response as IPushSettings);
  return bare && typeof bare === "object" ? { ...NOT_SET_UP, ...bare } : NOT_SET_UP;
};

const toAck = (response: IPushSettingsAck): IPushSettingsAck => ({
  isSuccess: response?.isSuccess !== false,
  errors: response?.errors ?? null,
});

export class PushSettingsService {
  getSettings(): Promise<IPushSettings> {
    return http
      .get<IPushSettings | IAPIResponse<IPushSettings>>(
        PUSH_SETTINGS_ENDPOINTS.SETTINGS(),
        undefined,
        ABSOLUTE,
      )
      .then(toSettings);
  }

  saveSettings(payload: ISavePushSettingsPayload): Promise<IPushSettingsAck> {
    return http
      .post<IPushSettingsAck>(PUSH_SETTINGS_ENDPOINTS.SETTINGS(), payload, undefined, ABSOLUTE)
      .then(toAck);
  }

  sendTest(): Promise<IPushSettingsAck> {
    return http
      .post<IPushSettingsAck>(PUSH_SETTINGS_ENDPOINTS.TEST(), {}, undefined, ABSOLUTE)
      .then(toAck);
  }
}

export const pushSettingsService = new PushSettingsService();
