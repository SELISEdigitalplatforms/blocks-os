import { useSettingsSignUpSetting } from "@blocks-idp/settings/hooks/use-settings-config"
import { ConfigErrorState } from "@blocks-idp/settings/components/config-error-state"
import { ConfigLoadingState } from "@blocks-idp/settings/components/config-loading-state"
import { SignupSettingsForm } from "@blocks-idp/settings/components/signup-settings-form"

export const SignupSettingsTab = () => {
  const { data, isLoading, isError } = useSettingsSignUpSetting()

  if (isLoading) {
    return <ConfigLoadingState fieldCount={5} />
  }

  if (isError || !data) {
    return <ConfigErrorState />
  }

  return <SignupSettingsForm config={data} />
}
