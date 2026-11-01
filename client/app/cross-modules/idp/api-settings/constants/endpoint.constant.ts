import { tStatic } from "@seliseblocks/genesis-os";

const API_ENDPOINT_CONFIG_SUBPATH = "/ApiEndpointConfig";

export const API_SETTINGS_ENDPOINTS = {
  GET_LIST: `/api${API_ENDPOINT_CONFIG_SUBPATH}/GetList`,
  UPDATE: `/api${API_ENDPOINT_CONFIG_SUBPATH}/Update`,
  BULK_UPDATE: `/api${API_ENDPOINT_CONFIG_SUBPATH}/BulkUpdate`,
  REMOVE: `/api${API_ENDPOINT_CONFIG_SUBPATH}/Remove`,
} as const;

/**
 * Client-side metadata for known service groups. `description` is a getter so the text is
 * looked up when it is shown and follows the language.
 */
export const SERVICE_META: Record<string, { description: string; icon: string }> = {
  Authentication: {
    get description() {
      return tStatic("os.idp.api-settings", "ENDPOINT_CONSTANT.AUTHENTICATION");
    },
    icon: "Lock",
  },
  Captcha: {
    get description() {
      return tStatic("os.idp.api-settings", "ENDPOINT_CONSTANT.CAPTCHA");
    },
    icon: "Shield",
  },
  Iam: {
    get description() {
      return tStatic("os.idp.api-settings", "ENDPOINT_CONSTANT.IAM");
    },
    icon: "Users",
  },
  Mfa: {
    get description() {
      return tStatic("os.idp.api-settings", "ENDPOINT_CONSTANT.MFA");
    },
    icon: "Smartphone",
  },
  Storage: {
    get description() {
      return tStatic("os.idp.api-settings", "ENDPOINT_CONSTANT.STORAGE");
    },
    icon: "HardDrive",
  },
  Communication: {
    get description() {
      return tStatic("os.idp.api-settings", "ENDPOINT_CONSTANT.COMMUNICATION");
    },
    icon: "Mail",
  },
};

export const DEFAULT_SERVICE_META = {
  get description() {
    return tStatic("os.idp.api-settings", "ENDPOINT_CONSTANT.DEFAULT");
  },
  icon: "Settings",
};
