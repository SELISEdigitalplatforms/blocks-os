import { AuthSettingsForm } from "@blocks-idp/settings/components/auth-settings-form"
import { ConfigErrorState } from "@blocks-idp/settings/components/config-error-state"
import { AuthTabLoadingState } from "@blocks-idp/settings/components/settings-tab-loading-state"
import { useSettingsAuthConfig } from "@blocks-idp/settings/hooks/use-settings-config"
import { getSettingsTabQueryState } from "@blocks-idp/settings/hooks/use-settings-tab-query"

export const AuthConfigTab = () => {
  const query = useSettingsAuthConfig()
  const { data, showLoader, showError } = getSettingsTabQueryState(query)

  if (showLoader) {
    return <AuthTabLoadingState />
  }

  if (showError || !data) {
    return <ConfigErrorState />
  }

  return <AuthSettingsForm config={data} />
}
