import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui-kits/form/form"
import { Switch } from "@/components/ui-kits/switch/switch"
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast"
import { isErrorWithErrors } from "@/lib/error"
import { cn } from "@/lib/utils"
import { EnableMultiOrgDialog } from "@blocks-idp/settings/components/enable-multi-org-dialog"
import {
  SettingsFormTabButtons,
  SettingsTabActions,
} from "@blocks-idp/settings/components/settings-tab-actions"
import { SettingsToggleCard } from "@blocks-idp/settings/components/settings-toggle-card"
import { SETTINGS_FORM_LAYOUT } from "@blocks-idp/settings/constants/settings-form-layout"
import { useSaveSettingsOrganizationConfig } from "@blocks-idp/settings/hooks/use-settings-config"
import type { ISettingsOrganizationConfig } from "@blocks-idp/settings/models/settings.model"
import {
  buildOrganizationConfigSavePayload,
  organizationConfigFormSchema,
  toOrganizationConfigFormValues,
  type OrganizationConfigFormValues,
} from "@blocks-idp/settings/utils/organization-config-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Lock } from "lucide-react"
import { useCallback, useId, useMemo, useState } from "react"
import { useForm, useFormState } from "react-hook-form"

type OrganizationConfigFormProps = {
  config: ISettingsOrganizationConfig
}

const CREATION_WORKFLOWS = [
  {
    name: "allowOrgCreationFromCloud" as const,
    label: "Allow Organization Creation from Cloud",
    description: "Automated provisioning via Global Cloud API.",
  },
  {
    name: "allowOrgCreationFromSignup" as const,
    label: "Allow Organization Creation from Construct Signup",
    description: "Self-service creation during construct user signup.",
  },
  {
    name: "allowOrgCreationFromPortal" as const,
    label: "Allow Organization Creation from Construct Portal",
    description: "Manual provisioning via construct admin dashboard.",
  },
]

type CreationWorkflowTileProps = {
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}

const CreationWorkflowTile = ({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: CreationWorkflowTileProps) => {
  const switchId = useId()

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
      <p
        className={cn(
          SETTINGS_FORM_LAYOUT.toggleDescription,
          "col-start-1 row-start-2 pr-2",
        )}
      >
        {description}
      </p>
    </FormItem>
  )
}

export const OrganizationConfigForm = ({ config }: OrganizationConfigFormProps) => {
  const { mutateAsync, isPending } = useSaveSettingsOrganizationConfig()
  const [enableDialogOpen, setEnableDialogOpen] = useState(false)

  const isMultiOrgEnabled = config.isMultiOrgEnabled
  const fieldsReadOnly = !isMultiOrgEnabled

  const formValues = useMemo(() => toOrganizationConfigFormValues(config), [config])

  const form = useForm<OrganizationConfigFormValues>({
    values: formValues,
    resolver: zodResolver(organizationConfigFormSchema),
  })

  const { isDirty } = useFormState({ control: form.control })

  const handleReset = useCallback(() => {
    form.reset(toOrganizationConfigFormValues(config))
  }, [config, form])

  const handleSubmit = useCallback(
    async (values: OrganizationConfigFormValues) => {
      try {
        const res = await mutateAsync(buildOrganizationConfigSavePayload(config, values))
        if (!res.isSuccess) return showErrorToast({ errors: res.errors })
        showSuccessToast({ description: "Organization configuration updated successfully" })
      } catch (error) {
        if (isErrorWithErrors(error)) return showErrorToast({ errors: error.errors })
        showErrorToast({ errors: "Something went wrong" })
      }
    },
    [config, mutateAsync],
  )

  const handleMultiOrgToggle = useCallback(
    (checked: boolean) => {
      if (!checked || isMultiOrgEnabled) return
      setEnableDialogOpen(true)
    },
    [isMultiOrgEnabled],
  )

  const tabActions = useMemo(
    () => (
      <SettingsFormTabButtons
        onReset={handleReset}
        onSave={form.handleSubmit(handleSubmit)}
        resetDisabled={fieldsReadOnly || !isDirty || isPending}
        saveDisabled={fieldsReadOnly || !isDirty || isPending}
      />
    ),
    [fieldsReadOnly, form, handleReset, handleSubmit, isDirty, isPending],
  )

  return (
    <div className={SETTINGS_FORM_LAYOUT.formRoot}>
      <Form {...form}>
        <SettingsTabActions tabId="organization-config">{tabActions}</SettingsTabActions>
        <form className={SETTINGS_FORM_LAYOUT.formStack} onSubmit={form.handleSubmit(handleSubmit)}>
          <SettingsToggleCard
            label="Multi-Organization Environment"
            description="Enable this to manage multiple isolated organization units under a single administrative umbrella. This enables hierarchical resource management."
            checked={isMultiOrgEnabled}
            onCheckedChange={handleMultiOrgToggle}
            disabled={isMultiOrgEnabled}
          />

          <Card>
            <CardHeader className="mb-4 flex flex-row items-start justify-between gap-3">
              <CardTitle className="text-base sm:text-lg">Organization Creation Workflows</CardTitle>
              {fieldsReadOnly ? (
                <Lock
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-label="Locked until multi-organization mode is enabled"
                />
              ) : null}
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
                          disabled={fieldsReadOnly}
                          onCheckedChange={field.onChange}
                        />
                      </div>
                    )}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>

      <EnableMultiOrgDialog
        config={config}
        open={enableDialogOpen}
        onOpenChange={setEnableDialogOpen}
      />
    </div>
  )
}
