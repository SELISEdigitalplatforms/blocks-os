import { useGetPermissions } from "@blocks-idp/iam/hooks/use-permission";
import { useGetRoles } from "@blocks-idp/iam/hooks/use-roles";
import { ConfigErrorState } from "@blocks-idp/settings/components/config-error-state";
import { SignupTabLoadingState } from "@blocks-idp/settings/components/settings-tab-loading-state";
import { SignInMethodsCard } from "@blocks-idp/settings/components/sign-in-methods-card";
import { SignupSettingsForm } from "@blocks-idp/settings/components/signup-settings-form";
import { useSettingsSignUpSetting } from "@blocks-idp/settings/hooks/use-settings-config";
import { useSettingsTenantId } from "@blocks-idp/settings/hooks/use-settings-tenant-id";
import { getSettingsTabQueryState } from "@blocks-idp/settings/hooks/use-settings-tab-query";

export const SignupSettingsTab = () => {
  const tenantId = useSettingsTenantId();
  const configQuery = useSettingsSignUpSetting();
  const rolesQuery = useGetRoles({
    page: 0,
    pageSize: 1000,
    sort: { property: "Name", isDescending: false },
    filter: { search: "" },
  });
  const permissionsQuery = useGetPermissions({
    projectKey: tenantId,
    page: 0,
    pageSize: 1000,
    search: "",
    isBuiltIn: "",
    roles: [],
    sort: { property: "Name", isDescending: false },
  });

  const configState = getSettingsTabQueryState(configQuery);
  const showLoader = configState.showLoader || rolesQuery.isPending || permissionsQuery.isPending;
  const showError = configState.showError || rolesQuery.isError || permissionsQuery.isError;

  if (showLoader) {
    return <SignupTabLoadingState />;
  }

  // The sign-in card loads on its own, so a failed signup config does not hide it.
  return (
    <div className="flex flex-col gap-6">
      {showError || !configState.data ? (
        <ConfigErrorState />
      ) : (
        <SignupSettingsForm config={configState.data} />
      )}
      <SignInMethodsCard />
    </div>
  );
};
