import type { SettingsTabValue } from "@blocks-idp/settings/models/settings.model"

export type SettingsTabMeta = {
  title: string
  description: string
}

export const SETTINGS_TAB_META: Record<SettingsTabValue, SettingsTabMeta> = {
  "auth-config": {
    title: "Auth Configuration",
    description:
      "Configure authentication policies, token validity, account lockout rules, and certificate settings.",
  },
  "iam-config": {
    title: "IAM Configuration",
    description:
      "Manage identity protocols, activation flows, and account security parameters.",
  },
  "signup-settings": {
    title: "Signup Configuration",
    description: "Configure self-service signup and default roles and permissions for new users.",
  },
  "organization-config": {
    title: "Organization Configuration",
    description:
      "Manage multi-organization mode and organization creation sources.",
  },
}
