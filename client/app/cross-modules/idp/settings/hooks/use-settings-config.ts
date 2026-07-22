import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useProjectStore } from "@seliseblocks/blocks-kit"
import { settingsConfigService } from "@blocks-idp/settings/services/settings-config.service"
import type {
  ISettingsSaveAuthConfigPayload,
  ISettingsSaveOrganizationConfigPayload,
  ISettingsSaveSignupConfigPayload,
} from "@blocks-idp/settings/models/settings.model"

// These settings endpoints resolve the tenant from the request token, so the active
// tenant must be part of each query key to avoid serving another project's cache.
export const useSettingsAuthConfig = () => {
  const tenantId = useProjectStore().selectedProject?.tenantId || ""
  return useQuery({
    queryKey: ["settings", "auth-config", tenantId],
    queryFn: () => settingsConfigService.getAuthConfig(),
    enabled: !!tenantId,
  })
}

export const useSaveSettingsAuthConfig = () => {
  const queryClient = useQueryClient()
  const tenantId = useProjectStore().selectedProject?.tenantId || ""

  return useMutation({
    mutationKey: ["settings", "auth-config", "save"],
    mutationFn: (payload: ISettingsSaveAuthConfigPayload) =>
      settingsConfigService.saveAuthConfig(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings", "auth-config", tenantId] })
      void queryClient.invalidateQueries({ queryKey: ["authentication", "auth-config"] })
    },
  })
}

export const useSettingsOrganizationConfig = () => {
  const tenantId = useProjectStore().selectedProject?.tenantId || ""
  return useQuery({
    queryKey: ["settings", "organization-config", tenantId],
    queryFn: () => settingsConfigService.getOrganizationConfig(),
    enabled: !!tenantId,
  })
}

export const useSaveSettingsOrganizationConfig = () => {
  const queryClient = useQueryClient()
  const tenantId = useProjectStore().selectedProject?.tenantId || ""

  return useMutation({
    mutationKey: ["settings", "organization-config", "save"],
    mutationFn: (payload: ISettingsSaveOrganizationConfigPayload) =>
      settingsConfigService.saveOrganizationConfig(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings", "organization-config", tenantId] })
    },
  })
}

export const useSettingsSignUpSetting = () => {
  const tenantId = useProjectStore().selectedProject?.tenantId || ""
  return useQuery({
    queryKey: ["settings", "signup-settings", tenantId],
    queryFn: () => settingsConfigService.getSignUpSetting(),
    enabled: !!tenantId,
  })
}

export const useSaveSettingsSignUpSetting = () => {
  const queryClient = useQueryClient()
  const tenantId = useProjectStore().selectedProject?.tenantId || ""

  return useMutation({
    mutationKey: ["settings", "signup-settings", "save"],
    mutationFn: (payload: ISettingsSaveSignupConfigPayload) =>
      settingsConfigService.saveSignUpSetting(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings", "signup-settings", tenantId] })
    },
  })
}
