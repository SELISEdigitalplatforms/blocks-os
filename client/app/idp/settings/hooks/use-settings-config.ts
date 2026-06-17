import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { settingsConfigService } from "@blocks-idp/settings/services/settings-config.service"
import type {
  ISettingsSaveAuthConfigPayload,
  ISettingsSaveOrganizationConfigPayload,
  ISettingsSaveSignupConfigPayload,
} from "@blocks-idp/settings/models/settings.model"

export const useSettingsAuthConfig = () =>
  useQuery({
    queryKey: ["settings", "auth-config"],
    queryFn: () => settingsConfigService.getAuthConfig(),
  })

export const useSaveSettingsAuthConfig = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ["settings", "auth-config", "save"],
    mutationFn: (payload: ISettingsSaveAuthConfigPayload) =>
      settingsConfigService.saveAuthConfig(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings", "auth-config"] })
      void queryClient.invalidateQueries({ queryKey: ["authentication", "auth-config"] })
    },
  })
}

export const useSettingsOrganizationConfig = () =>
  useQuery({
    queryKey: ["settings", "organization-config"],
    queryFn: () => settingsConfigService.getOrganizationConfig(),
  })

export const useSaveSettingsOrganizationConfig = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ["settings", "organization-config", "save"],
    mutationFn: (payload: ISettingsSaveOrganizationConfigPayload) =>
      settingsConfigService.saveOrganizationConfig(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings", "organization-config"] })
    },
  })
}

export const useSettingsSignUpSetting = () =>
  useQuery({
    queryKey: ["settings", "signup-settings"],
    queryFn: () => settingsConfigService.getSignUpSetting(),
  })

export const useSaveSettingsSignUpSetting = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ["settings", "signup-settings", "save"],
    mutationFn: (payload: ISettingsSaveSignupConfigPayload) =>
      settingsConfigService.saveSignUpSetting(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings", "signup-settings"] })
    },
  })
}
