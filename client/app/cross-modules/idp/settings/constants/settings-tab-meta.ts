import type { SettingsTabValue } from "@blocks-idp/settings/models/settings.model";

/** Translation keys (module os.idp.settings) of a tab's page title and description. */
export type SettingsTabMeta = {
  titleKey: string;
  descriptionKey: string;
};

export const SETTINGS_TAB_META: Record<SettingsTabValue, SettingsTabMeta> = {
  "auth-config": {
    titleKey: "SETTINGS_TAB_META.AUTH_CONFIG_TITLE",
    descriptionKey: "SETTINGS_TAB_META.AUTH_CONFIG_DESCRIPTION",
  },
  "iam-config": {
    titleKey: "SETTINGS_TAB_META.IAM_CONFIG_TITLE",
    descriptionKey: "SETTINGS_TAB_META.IAM_CONFIG_DESCRIPTION",
  },
  "signup-settings": {
    titleKey: "SETTINGS_TAB_META.SIGNUP_SETTINGS_TITLE",
    descriptionKey: "SETTINGS_TAB_META.SIGNUP_SETTINGS_DESCRIPTION",
  },
  "organization-config": {
    titleKey: "SETTINGS_TAB_META.ORGANIZATION_CONFIG_TITLE",
    descriptionKey: "SETTINGS_TAB_META.ORGANIZATION_CONFIG_DESCRIPTION",
  },
};
