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
import type { Control } from "react-hook-form";

export const DEFAULT_SIGNUP_ORGANIZATION_ID = "default";

export const SIGNUP_AUTO_JOIN_COPY = {
  title: "Add new sign-ups to an organization",
  description: "New users who sign up join the organization you choose.",
  disabledTooltip: "Turn on multi-organization first.",
  pickerLabel: "Organization for new sign-ups",
  helper: "Sign-ups fail if this organization is deleted or disabled.",
  warningTitle: "New users get tenant-wide access",
  warningBody:
    "Users who join Default can act across the whole project. Choose a specific organization to limit access.",
} as const;

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
  const showPicker = isMultiOrgEnabled && isEnabled;

  return (
    <div className="flex flex-col gap-4" data-testid="signup-auto-join-card">
      <SettingsToggleCard
        label={SIGNUP_AUTO_JOIN_COPY.title}
        description={SIGNUP_AUTO_JOIN_COPY.description}
        checked={isEnabled}
        onCheckedChange={onEnabledChange}
        disabled={!isMultiOrgEnabled || disabled}
        disabledTooltip={!isMultiOrgEnabled ? SIGNUP_AUTO_JOIN_COPY.disabledTooltip : undefined}
      />

      {showPicker ? (
        <FormField
          control={control}
          name="signupAutoJoinOrganizationId"
          render={() => (
            <FormItem className="w-full min-w-0">
              <FormLabel className={SETTINGS_FORM_LAYOUT.fieldLabel}>
                {SIGNUP_AUTO_JOIN_COPY.pickerLabel}
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
                {SIGNUP_AUTO_JOIN_COPY.helper}
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
          title={SIGNUP_AUTO_JOIN_COPY.warningTitle}
        >
          {SIGNUP_AUTO_JOIN_COPY.warningBody}
        </Banner>
      ) : null}
    </div>
  );
};
