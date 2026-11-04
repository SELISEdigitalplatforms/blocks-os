import { Banner } from "@/components/ui-kits/banner/banner";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { OrganizationCombobox } from "@blocks-idp/iam/components/organization-combobox";
import { SettingsToggleCard } from "@blocks-idp/settings/components/settings-toggle-card";
import { SETTINGS_FORM_LAYOUT } from "@blocks-idp/settings/constants/settings-form-layout";
import type { OrganizationConfigFormValues } from "@blocks-idp/settings/utils/organization-config-form";
import { useT } from "@seliseblocks/genesis-os";
import type { Control } from "react-hook-form";

export const DEFAULT_SIGNUP_ORGANIZATION_ID = "default";

type SignupAutoJoinCardProps = {
  control: Control<OrganizationConfigFormValues>;
  projectKey: string;
  isMultiOrgEnabled: boolean;
  isEnabled: boolean;
  organizationId: string;
  disabled?: boolean;
  onEnabledChange: (checked: boolean) => void;
  onOrganizationChange: (organizationId: string) => void;
};

export const SignupAutoJoinCard = ({
  control,
  projectKey,
  isMultiOrgEnabled,
  isEnabled,
  organizationId,
  disabled = false,
  onEnabledChange,
  onOrganizationChange,
}: SignupAutoJoinCardProps) => {
  const { t } = useT("os.idp.settings");
  const showPicker = isMultiOrgEnabled && isEnabled;

  return (
    <div className="flex flex-col gap-4" data-testid="signup-auto-join-card">
      <SettingsToggleCard
        label={t("SIGNUP_AUTO_JOIN_CARD.TITLE")}
        description={t("SIGNUP_AUTO_JOIN_CARD.DESCRIPTION")}
        checked={isEnabled}
        onCheckedChange={onEnabledChange}
        disabled={!isMultiOrgEnabled || disabled}
        disabledTooltip={
          isMultiOrgEnabled ? undefined : t("SIGNUP_AUTO_JOIN_CARD.DISABLED_TOOLTIP")
        }
      />

      {showPicker ? (
        <FormField
          control={control}
          name="signupAutoJoinOrganizationId"
          render={() => (
            <FormItem className="w-full min-w-0">
              <FormLabel className={SETTINGS_FORM_LAYOUT.fieldLabel}>
                {t("SIGNUP_AUTO_JOIN_CARD.PICKER_LABEL")}
              </FormLabel>
              <FormControl>
                <OrganizationCombobox
                  projectKey={projectKey}
                  value={organizationId}
                  onValueChange={onOrganizationChange}
                  disabled={disabled}
                  excludeNotEnabled
                />
              </FormControl>
              <p className={SETTINGS_FORM_LAYOUT.fieldDescription}>
                {t("SIGNUP_AUTO_JOIN_CARD.HELPER")}
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}

      {showPicker && organizationId === DEFAULT_SIGNUP_ORGANIZATION_ID ? (
        <Banner
          variant="warning"
          className="mb-0"
          compact={false}
          title={t("SIGNUP_AUTO_JOIN_CARD.WARNING_TITLE")}
        >
          {t("SIGNUP_AUTO_JOIN_CARD.WARNING_BODY")}
        </Banner>
      ) : null}
    </div>
  );
};
