import { IamSettingsForm } from "@blocks-idp/settings/components/iam-settings-form"
import { ConfigErrorState } from "@blocks-idp/settings/components/config-error-state"
import { ConfigLoadingState } from "@blocks-idp/settings/components/config-loading-state"
import { useSettingsAuthConfig } from "@blocks-idp/settings/hooks/use-settings-config"

export const IamConfigTab = () => {
  const { data, isLoading, isFetching, isError } = useSettingsAuthConfig()

  if (isLoading || isFetching) {
    return <ConfigLoadingState fieldCount={7} />
  }

  if (isError || !data) {
    return <ConfigErrorState />
  }

  return <IamSettingsForm config={data} />
}
