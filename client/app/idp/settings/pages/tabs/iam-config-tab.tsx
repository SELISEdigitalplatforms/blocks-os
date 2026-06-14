import { useSettingsAuthConfig } from "@blocks-idp/settings/hooks/use-settings-config"
import { ConfigErrorState } from "@blocks-idp/settings/components/config-error-state"
import { ConfigFieldGrid } from "@blocks-idp/settings/components/config-field-grid"
import { ConfigLoadingState } from "@blocks-idp/settings/components/config-loading-state"
import { ConfigReadOnlyCard } from "@blocks-idp/settings/components/config-read-only-card"
import { useSettingsTenantId } from "@blocks-idp/settings/hooks/use-settings-tenant-id"
import {
  formatBoolean,
  formatMinutes,
  formatText,
  joinAccountActionUrl,
} from "@blocks-idp/settings/utils/format-config"

export const IamConfigTab = () => {
  const tenantId = useSettingsTenantId()
  const { data, isLoading, isFetching, isError } = useSettingsAuthConfig(tenantId)

  if (!tenantId) {
    return <ConfigErrorState message="Select a project to load IAM configuration." />
  }

  if (isLoading || isFetching) {
    return <ConfigLoadingState fieldCount={7} />
  }

  if (isError || !data) {
    return <ConfigErrorState />
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <ConfigReadOnlyCard title="IAM Config">
        <ConfigFieldGrid
          fields={[
            { label: "Config ID", value: formatText(data.itemId) },
            {
              label: "Account Activation URL",
              value: joinAccountActionUrl(data.accountActionBaseUrl, data.accountActivationPath),
            },
            {
              label: "Account Verification URL",
              value: joinAccountActionUrl(data.accountActionBaseUrl, data.accountVerificationPath),
            },
            {
              label: "Recover Account URL",
              value: joinAccountActionUrl(data.accountActionBaseUrl, data.recoverAccountPath),
            },
            {
              label: "Activation URL Lifetime",
              value: formatMinutes(data.activationUrlLifetimeInMinutes),
            },
            {
              label: "Recover Account URL Lifetime",
              value: formatMinutes(data.recoverAccountUrlLifetimeInMinutes),
            },
            {
              label: "Logout on Password Change",
              value: formatBoolean(data.logoutOnPasswordChange),
            },
          ]}
        />
      </ConfigReadOnlyCard>
    </div>
  )
}
