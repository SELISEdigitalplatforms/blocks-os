import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui-kits/form/form";
import { Switch } from "@/components/ui-kits/switch/switch";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { cn } from "@/lib/utils";
import { EnableMultiOrgDialog } from "@blocks-idp/settings/components/enable-multi-org-dialog";
import {
  SettingsFormTabButtons,
  SettingsTabActions,
} from "@blocks-idp/settings/components/settings-tab-actions";
import { SettingsToggleCard } from "@blocks-idp/settings/components/settings-toggle-card";
import { SETTINGS_FORM_LAYOUT } from "@blocks-idp/settings/constants/settings-form-layout";
import { useSaveSettingsOrganizationConfig } from "@blocks-idp/settings/hooks/use-settings-config";
import type { ISettingsOrganizationConfig } from "@blocks-idp/settings/models/settings.model";
import {
  buildOrganizationConfigSavePayload,
  organizationConfigFormSchema,
  toOrganizationConfigFormValues,
  type OrganizationConfigFormValues,
} from "@blocks-idp/settings/utils/organization-config-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useId, useMemo, useState } from "react";
import { useForm, useFormState } from "react-hook-form";

type OrganizationConfigFormProps = {
  config: ISettingsOrganizationConfig;
};

const CREATION_WORKFLOWS = [
  {
    name: "allowOrgCreationFromCloud" as const,
    label: "Allow Creation from Cloud",
    description: "Automated provisioning via Global Cloud API.",
  },
  {
    name: "allowOrgCreationFromSignup" as const,
    label: "Allow Creation from Construct Signup",
    description: "Self-service creation during construct user signup.",
  },
  {
    name: "allowOrgCreationFromPortal" as const,
    label: "Allow Creation from Construct",
    description: "Manual provisioning via construct admin dashboard.",
  },
];

type CreationWorkflowTileProps = {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
};

const CreationWorkflowTile = ({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: CreationWorkflowTileProps) => {
  const switchId = useId();

  return (
    <FormItem className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 space-y-0 p-3 sm:p-4">
      <FormLabel
        htmlFor={switchId}
        className={cn(
          SETTINGS_FORM_LAYOUT.toggleTitle,
          "col-start-1 row-start-1 pr-2",
          !disabled && "cursor-pointer",
        )}
      >
        {label}
      </FormLabel>
      <FormControl className="col-start-2 row-start-1 self-start">
        <Switch
          id={switchId}
          checked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
          aria-label={label}
          className={cn(
            disabled &&
              "disabled:data-[state=checked]:border-blocks-primary-400 disabled:data-[state=checked]:bg-blocks-primary-400",
          )}
        />
      </FormControl>
      <p className={cn(SETTINGS_FORM_LAYOUT.toggleDescription, "col-start-1 row-start-2 pr-2")}>
        {description}
      </p>
    </FormItem>
  );
};

export const OrganizationConfigForm = ({ config }: OrganizationConfigFormProps) => {
  const { mutateAsync, isPending } = useSaveSettingsOrganizationConfig();
  const [enableDialogOpen, setEnableDialogOpen] = useState(false);

  const formValues = useMemo(() => toOrganizationConfigFormValues(config), [config]);

  const form = useForm<OrganizationConfigFormValues>({
    values: formValues,
    resolver: zodResolver(organizationConfigFormSchema),
  });

  const { isDirty } = useFormState({ control: form.control });

  // Pending state: the toggle reflects the form, so enabling stays unsaved until
  // Save. Once persisted, multi-org can never be turned back off.
  const isMultiOrgEnabled = form.watch("isMultiOrgEnabled");
  const isMultiOrgLocked = config.isMultiOrgEnabled;

  const handleReset = useCallback(() => {
    form.reset(toOrganizationConfigFormValues(config));
  }, [config, form]);

  const handleSubmit = useCallback(
    async (values: OrganizationConfigFormValues) => {
      try {
        const res = await mutateAsync(buildOrganizationConfigSavePayload(config, values));
        if (!res.isSuccess) return showErrorToast({ errors: res.errors });
        showSuccessToast({ description: "Organization configuration updated successfully" });
      } catch (error) {
        if (isErrorWithErrors(error)) return showErrorToast({ errors: error.errors });
        showErrorToast({ errors: "Something went wrong" });
      }
    },
    [config, mutateAsync],
  );

  const handleMultiOrgToggle = useCallback(
    (checked: boolean) => {
      if (isMultiOrgLocked) return;

      if (!checked) {
        // Not saved yet, so the user can still take it back.
        form.setValue("isMultiOrgEnabled", false, { shouldDirty: true });
        return;
      }

      setEnableDialogOpen(true);
    },
    [form, isMultiOrgLocked],
  );

  const handleConfirmEnable = useCallback(() => {
    form.setValue("isMultiOrgEnabled", true, { shouldDirty: true });
    setEnableDialogOpen(false);
  }, [form]);

  const tabActions = useMemo(
    () => (
      <SettingsFormTabButtons
        onReset={handleReset}
        onSave={form.handleSubmit(handleSubmit)}
        resetDisabled={!isDirty || isPending}
        saveDisabled={!isDirty || isPending}
      />
    ),
    [form, handleReset, handleSubmit, isDirty, isPending],
  );

  return (
    <div className={SETTINGS_FORM_LAYOUT.formRoot}>
      <Form {...form}>
        <SettingsTabActions tabId="organization-config">{tabActions}</SettingsTabActions>
        <form className={SETTINGS_FORM_LAYOUT.formStack} onSubmit={form.handleSubmit(handleSubmit)}>
          <SettingsToggleCard
            label="Multi-Organization Environment"
            description="Manage multiple organizations from one workspace. Keep resources organized with a clear hierarchy."
            checked={isMultiOrgEnabled}
            onCheckedChange={handleMultiOrgToggle}
            disabled={isMultiOrgLocked || isPending}
          />

          {isMultiOrgEnabled ? (
            <Card>
              <CardHeader className={SETTINGS_FORM_LAYOUT.sectionHeader}>
                <CardTitle className={SETTINGS_FORM_LAYOUT.sectionTitle}>
                  Organization Creation Workflows
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col divide-y overflow-hidden rounded-lg border bg-muted/20 lg:flex-row lg:divide-x lg:divide-y-0">
                  {CREATION_WORKFLOWS.map((workflow) => (
                    <FormField
                      key={workflow.name}
                      name={workflow.name}
                      control={form.control}
                      render={({ field }) => (
                        <div className="w-full min-w-0 flex-1">
                          <CreationWorkflowTile
                            label={workflow.label}
                            description={workflow.description}
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </div>
                      )}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </form>
      </Form>

      <EnableMultiOrgDialog
        open={enableDialogOpen}
        onOpenChange={setEnableDialogOpen}
        onConfirm={handleConfirmEnable}
      />
    </div>
  );
};
