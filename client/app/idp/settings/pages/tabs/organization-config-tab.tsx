import { useSettingsOrganizationConfig } from "@blocks-idp/settings/hooks/use-settings-config"
import { ConfigErrorState } from "@blocks-idp/settings/components/config-error-state"
import { ConfigFieldGrid } from "@blocks-idp/settings/components/config-field-grid"
import { ConfigLoadingState } from "@blocks-idp/settings/components/config-loading-state"
import { ConfigReadOnlyCard } from "@blocks-idp/settings/components/config-read-only-card"
import { useSettingsTenantId } from "@blocks-idp/settings/hooks/use-settings-tenant-id"
import { formatBoolean, formatList, formatText } from "@blocks-idp/settings/utils/format-config"

export const OrganizationConfigTab = () => {
  const tenantId = useSettingsTenantId()
  const { data, isLoading, isFetching, isError } = useSettingsOrganizationConfig(tenantId)

  if (!tenantId) {
    return <ConfigErrorState message="Select a project to load organization configuration." />
  }

  if (isLoading || isFetching) {
    return <ConfigLoadingState fieldCount={8} />
  }

  if (isError || !data) {
    return <ConfigErrorState />
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <ConfigReadOnlyCard title="Organization Config">
        <ConfigFieldGrid
          fields={[
            { label: "Config ID", value: formatText(data.itemId) },
            {
              label: "Allow Org Creation From Cloud",
              value: formatBoolean(data.allowCreationFromCloud),
            },
            {
              label: "Allow Org Creation From Construct",
              value: formatBoolean(data.allowCreationFromConstruct),
            },
            {
              label: "Allow Org Creation From Signup",
              value: formatBoolean(data.allowOrgCreationFromSignup),
            },
            {
              label: "Allow Org Creation From Portal",
              value: formatBoolean(data.allowOrgCreationFromPortal),
            },
            {
              label: "Multi-Org Enabled",
              value: formatBoolean(data.isMultiOrgEnabled),
            },
            {
              label: "Default Role On Org Creation",
              value: formatList(data.defaultRoleOnOrgCreation),
            },
            {
              label: "Default Permission On Org Creation",
              value: formatList(data.defaultPermissionOnOrgCreation),
            },
          ]}
        />
      </ConfigReadOnlyCard>
    </div>
  )
}
