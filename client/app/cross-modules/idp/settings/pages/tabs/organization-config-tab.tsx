import { OrganizationConfigForm } from "@blocks-idp/settings/components/organization-config-form"
import { ConfigErrorState } from "@blocks-idp/settings/components/config-error-state"
import { OrganizationTabLoadingState } from "@blocks-idp/settings/components/settings-tab-loading-state"
import { useSettingsOrganizationConfig } from "@blocks-idp/settings/hooks/use-settings-config"
import { getSettingsTabQueryState } from "@blocks-idp/settings/hooks/use-settings-tab-query"

export const OrganizationConfigTab = () => {
  const query = useSettingsOrganizationConfig()
  const { data, showLoader, showError } = getSettingsTabQueryState(query)

  if (showLoader) {
    return <OrganizationTabLoadingState />
  }

  if (showError || !data) {
    return <ConfigErrorState />
  }

  return <OrganizationConfigForm config={data} />
}
