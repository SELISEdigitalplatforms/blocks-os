import { useSettingsSignUpSetting } from "@blocks-idp/settings/hooks/use-settings-config"
import { ConfigErrorState } from "@blocks-idp/settings/components/config-error-state"
import { ConfigFieldGrid } from "@blocks-idp/settings/components/config-field-grid"
import { ConfigLoadingState } from "@blocks-idp/settings/components/config-loading-state"
import { ConfigReadOnlyCard } from "@blocks-idp/settings/components/config-read-only-card"
import { useSettingsTenantId } from "@blocks-idp/settings/hooks/use-settings-tenant-id"
import { formatBoolean, formatList, formatText } from "@blocks-idp/settings/utils/format-config"

export const SignupSettingsTab = () => {
  const tenantId = useSettingsTenantId()
  const { data, isLoading, isFetching, isError } = useSettingsSignUpSetting(tenantId)

  if (!tenantId) {
    return <ConfigErrorState message="Select a project to load signup settings." />
  }

  if (isLoading || isFetching) {
    return <ConfigLoadingState fieldCount={6} />
  }

  if (isError || !data) {
    return <ConfigErrorState />
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <ConfigReadOnlyCard title="Signup Settings">
        <ConfigFieldGrid
          fields={[
            { label: "Config ID", value: formatText(data.itemId || undefined) },
            {
              label: "Sign Up Enabled",
              value: formatBoolean(data.isSignUpEnable),
            },
            {
              label: "Email & Password Sign Up Enabled",
              value: formatBoolean(data.isEmailPasswordSignUpEnabled),
            },
            {
              label: "SSO Sign Up Enabled",
              value: formatBoolean(data.isSSoSignUpEnabled),
            },
            {
              label: "Default Roles For New User",
              value: formatList(data.defaultRolesForNewUser),
            },
            {
              label: "Default Permissions For New User",
              value: formatList(data.defaultPermissionsForNewUser),
            },
          ]}
        />
      </ConfigReadOnlyCard>
    </div>
  )
}
