import { useSettingsOrganizationConfig } from "@blocks-idp/settings/hooks/use-settings-config"
import { ConfigErrorState } from "@blocks-idp/settings/components/config-error-state"
import { ConfigLoadingState } from "@blocks-idp/settings/components/config-loading-state"
import { OrganizationConfigForm } from "@blocks-idp/settings/components/organization-config-form"

export const OrganizationConfigTab = () => {
  const { data, isLoading, isError } = useSettingsOrganizationConfig()

  if (isLoading) {
    return <ConfigLoadingState fieldCount={6} />
  }

  if (isError || !data) {
    return <ConfigErrorState />
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <OrganizationConfigForm config={data} />
    </div>
  )
}
