import { IamSettingsForm } from "@blocks-idp/settings/components/iam-settings-form";
import { ConfigErrorState } from "@blocks-idp/settings/components/config-error-state";
import { IamTabLoadingState } from "@blocks-idp/settings/components/settings-tab-loading-state";
import { useSettingsAuthConfig } from "@blocks-idp/settings/hooks/use-settings-config";
import { getSettingsTabQueryState } from "@blocks-idp/settings/hooks/use-settings-tab-query";

export const IamConfigTab = () => {
  const query = useSettingsAuthConfig();
  const { data, showLoader, showError } = getSettingsTabQueryState(query);

  if (showLoader) {
    return <IamTabLoadingState />;
  }

  if (showError || !data) {
    return <ConfigErrorState />;
  }

  return <IamSettingsForm config={data} />;
};
