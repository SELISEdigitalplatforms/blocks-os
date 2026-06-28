import { useGetPermissions } from "@blocks-idp/iam/hooks/use-permission"
import { useGetRoles } from "@blocks-idp/iam/hooks/use-roles"
import { ConfigErrorState } from "@blocks-idp/settings/components/config-error-state"
import { SignupTabLoadingState } from "@blocks-idp/settings/components/settings-tab-loading-state"
import { SignupSettingsForm } from "@blocks-idp/settings/components/signup-settings-form"
import { useSettingsSignUpSetting } from "@blocks-idp/settings/hooks/use-settings-config"
import { useSettingsTenantId } from "@blocks-idp/settings/hooks/use-settings-tenant-id"
import { getSettingsTabQueryState } from "@blocks-idp/settings/hooks/use-settings-tab-query"

export const SignupSettingsTab = () => {
  const tenantId = useSettingsTenantId()
  const configQuery = useSettingsSignUpSetting()
  const rolesQuery = useGetRoles({
    projectKey: tenantId,
    page: 0,
    pageSize: 1000,
    sort: { property: "Name", isDescending: false },
    filter: { search: "" },
  })
  const permissionsQuery = useGetPermissions({
    projectKey: tenantId,
    page: 0,
    pageSize: 1000,
    search: "",
    isBuiltIn: "",
    roles: [],
    sort: { property: "Name", isDescending: false },
  })

  const configState = getSettingsTabQueryState(configQuery)
  const showLoader =
    configState.showLoader || rolesQuery.isPending || permissionsQuery.isPending
  const showError =
    configState.showError || rolesQuery.isError || permissionsQuery.isError

  if (showLoader) {
    return <SignupTabLoadingState />
  }

  if (showError || !configState.data) {
    return <ConfigErrorState />
  }

  return <SignupSettingsForm config={configState.data} />
}
