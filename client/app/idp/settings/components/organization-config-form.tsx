import { Checkbox } from "@/components/ui-kits/checkbox/checkbox"
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
import { useCallback, useMemo, useState } from "react"
import { useForm, useFormState } from "react-hook-form"

type OrganizationConfigFormProps = {
  config: ISettingsOrganizationConfig
}

const CREATION_WORKFLOWS = [
  {
    name: "allowOrgCreationFromCloud" as const,
    label: "Allow Creation from Cloud",
    description: "Automated provisioning via Global Cloud API.",
  },
  {
    name: "allowOrgCreationFromConstruct" as const,
    label: "Allow Creation from Construct",
    description: "Provisioning via IaC templates.",
  },
  {
    name: "allowOrgCreationFromSignup" as const,
    label: "Allow Creation from Signup",
    description: "Self-service creation during user signup.",
  },
  {
    name: "allowOrgCreationFromPortal" as const,
    label: "Allow Creation from Portal",
    description: "Manual provisioning via admin dashboard.",
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
}: CreationWorkflowTileProps) => (
  <label
    className={cn(
      "flex cursor-pointer gap-3 rounded-lg border bg-card p-4 transition-colors",
      disabled && "pointer-events-none cursor-not-allowed",
      checked && !disabled && "border-primary/40 bg-primary/5",
    )}
  >
    <Checkbox
      checked={checked}
      disabled={disabled}
      onCheckedChange={(value) => onCheckedChange(value === true)}
      aria-label={label}
      className="mt-0.5 disabled:opacity-100"
    />
    <span className="min-w-0 space-y-1">
      <span className="block text-sm font-semibold text-foreground">{label}</span>
      <span className="block text-sm text-muted-foreground">{description}</span>
    </span>
  </label>
)

type ToggleCardProps = {
  label: string
  description?: string
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
}

const ToggleCard = ({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: ToggleCardProps) => (
  <Card>
    <FormItem className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <FormLabel className="!mt-0 text-sm font-semibold sm:text-base">{label}</FormLabel>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <FormControl className="shrink-0 self-start sm:self-center">
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          aria-label={label}
        />
      </FormControl>
    </FormItem>
  </Card>
)

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
    <div className="w-full min-w-0">
      <Form {...form}>
        <SettingsTabActions tabId="organization-config">{tabActions}</SettingsTabActions>
        <form className="flex flex-col gap-6" onSubmit={form.handleSubmit(handleSubmit)}>
          <ToggleCard
            label="Multi-Org Environment"
            description="Enable this to manage multiple isolated organization units under a single administrative umbrella. This enables hierarchical resource management."
            checked={isMultiOrgEnabled}
            onCheckedChange={handleMultiOrgToggle}
            disabled={isMultiOrgEnabled}
          />

          <Card>
            <CardHeader className="mb-4 flex flex-row items-start justify-between gap-3">
              <CardTitle className="text-base sm:text-lg">Creation Workflows</CardTitle>
              {fieldsReadOnly ? (
                <Lock
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-label="Locked until multi-organization mode is enabled"
                />
              ) : null}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {CREATION_WORKFLOWS.map((workflow) => (
                  <FormField
                    key={workflow.name}
                    name={workflow.name}
                    control={form.control}
                    render={({ field }) => (
                      <CreationWorkflowTile
                        label={workflow.label}
                        description={workflow.description}
                        checked={field.value}
                        disabled={fieldsReadOnly}
                        onCheckedChange={field.onChange}
                      />
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
