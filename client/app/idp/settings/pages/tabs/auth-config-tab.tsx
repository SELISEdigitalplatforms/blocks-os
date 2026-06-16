import { AuthSettingsForm } from "@blocks-idp/settings/components/auth-settings-form"
import { ConfigErrorState } from "@blocks-idp/settings/components/config-error-state"
import { ConfigLoadingState } from "@blocks-idp/settings/components/config-loading-state"
import { useSettingsAuthConfig } from "@blocks-idp/settings/hooks/use-settings-config"

export const AuthConfigTab = () => {
  const { data, isLoading, isFetching, isError } = useSettingsAuthConfig()

  if (isLoading || isFetching) {
    return <ConfigLoadingState fieldCount={8} />
  }

  if (isError || !data) {
    return <ConfigErrorState />
  }

  return <AuthSettingsForm config={data} />
}
