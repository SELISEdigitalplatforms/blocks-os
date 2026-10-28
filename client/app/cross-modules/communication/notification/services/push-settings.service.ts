import { http } from "@/lib/http/http-client";
import type { IAPIResponse } from "@/models/api-response";
import { PUSH_SETTINGS_ENDPOINTS } from "../constants/endpoint.constant";
import type {
  IPushSettings,
  IPushSettingsAck,
  ISavePushSettingsPayload,
} from "../models/push.model";

/** The shape a project has before anything is stored; also the answer when the read fails. */
export const NOT_SET_UP: IPushSettings = {
  projectId: null,
  enabled: false,
  hasKey: false,
  platforms: { android: true, ios: true, web: false },
  hasWebConfig: false,
};

/** The endpoint answers either wrapped in `data` or as the bare settings. */
const toSettings = (response: IPushSettings | IAPIResponse<IPushSettings>): IPushSettings => {
  const wrapped = (response as IAPIResponse<IPushSettings>)?.data;
  const bare = wrapped && !Array.isArray(wrapped) ? wrapped : (response as IPushSettings);
  if (!bare || typeof bare !== "object") return NOT_SET_UP;
  return { ...NOT_SET_UP, ...bare, platforms: { ...NOT_SET_UP.platforms, ...bare.platforms } };
};

const toAck = (response: IPushSettingsAck): IPushSettingsAck => ({
  isSuccess: response?.isSuccess !== false,
  errors: response?.errors ?? null,
});

export class PushSettingsService {
  getSettings(): Promise<IPushSettings> {
    return http
      .get<IPushSettings | IAPIResponse<IPushSettings>>(PUSH_SETTINGS_ENDPOINTS.GET)
      .then(toSettings);
  }

  saveSettings(payload: ISavePushSettingsPayload): Promise<IPushSettingsAck> {
    return http.post<IPushSettingsAck>(PUSH_SETTINGS_ENDPOINTS.SAVE, payload).then(toAck);
  }
}

export const pushSettingsService = new PushSettingsService();
