import { useQuery } from "@tanstack/react-query"
import { settingsConfigService } from "@blocks-idp/settings/services/settings-config.service"

export const useSettingsAuthConfig = (projectKey: string) =>
  useQuery({
    queryKey: ["settings", "auth-config", projectKey],
    queryFn: () => settingsConfigService.getAuthConfig(projectKey),
    enabled: !!projectKey,
  })

export const useSettingsOrganizationConfig = (projectKey: string) =>
  useQuery({
    queryKey: ["settings", "organization-config", projectKey],
    queryFn: () => settingsConfigService.getOrganizationConfig(projectKey),
    enabled: !!projectKey,
  })

export const useSettingsSignUpSetting = (projectKey: string) =>
  useQuery({
    queryKey: ["settings", "signup-settings", projectKey],
    queryFn: () => settingsConfigService.getSignUpSetting(projectKey),
    enabled: !!projectKey,
  })
