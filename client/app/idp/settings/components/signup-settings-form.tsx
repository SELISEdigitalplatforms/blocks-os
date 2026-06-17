import { Card } from "@/components/ui-kits/card/card"
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
import { SignupPermissionsSection } from "@blocks-idp/settings/components/signup-permissions-section"
import { SignupRolesSection } from "@blocks-idp/settings/components/signup-roles-section"
import { useGetPermissions } from "@blocks-idp/iam/hooks/use-permission"
import { useGetRoles } from "@blocks-idp/iam/hooks/use-roles"
import {
  SettingsFormTabButtons,
  SettingsTabActions,
} from "@blocks-idp/settings/components/settings-tab-actions"
import { useSaveSettingsSignUpSetting } from "@blocks-idp/settings/hooks/use-settings-config"
import { useSettingsTenantId } from "@blocks-idp/settings/hooks/use-settings-tenant-id"
import type { ISettingsSignupConfig } from "@blocks-idp/settings/models/settings.model"
import {
  buildSignupSettingsSavePayload,
  resolveSignupPermissions,
  resolveSignupRoles,
  signupSettingsFormSchema,
  toSignupSettingsFormValues,
  type SignupSettingsFormValues,
} from "@blocks-idp/settings/utils/signup-settings-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useCallback, useMemo } from "react"
import { useForm, useFormState } from "react-hook-form"

type SignupSettingsFormProps = {
  config: ISettingsSignupConfig
}

type ToggleCardProps = {
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

const ToggleCard = ({ label, description, checked, onCheckedChange }: ToggleCardProps) => (
  <Card>
    <FormItem className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <FormLabel className="!mt-0 text-sm font-semibold sm:text-base">{label}</FormLabel>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <FormControl className="shrink-0 self-start sm:self-center">
        <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
      </FormControl>
    </FormItem>
  </Card>
)

export const SignupSettingsForm = ({ config }: SignupSettingsFormProps) => {
  const tenantId = useSettingsTenantId()
  const { mutateAsync, isPending } = useSaveSettingsSignUpSetting()

  const { data: rolesData } = useGetRoles({
    projectKey: tenantId,
    page: 0,
    pageSize: 1000,
    sort: { property: "Name", isDescending: false },
    filter: { search: "" },
  })

  const { data: permissionsData } = useGetPermissions({
    projectKey: tenantId,
    page: 0,
    pageSize: 1000,
    search: "",
    isBuiltIn: "",
    roles: [],
    sort: { property: "Name", isDescending: false },
  })

  const formValues = useMemo(() => toSignupSettingsFormValues(config), [config])

  const form = useForm<SignupSettingsFormValues>({
    values: formValues,
    resolver: zodResolver(signupSettingsFormSchema),
  })

  const { isDirty } = useFormState({ control: form.control })
  const isEmailPasswordSignUpEnabled = form.watch("isEmailPasswordSignUpEnabled")
  const defaultRolesForNewUser = form.watch("defaultRolesForNewUser")
  const defaultPermissionsForNewUser = form.watch("defaultPermissionsForNewUser")

  const displayRoles = useMemo(
    () => resolveSignupRoles(defaultRolesForNewUser, rolesData?.data ?? []),
    [defaultRolesForNewUser, rolesData?.data],
  )

  const displayPermissions = useMemo(
    () =>
      resolveSignupPermissions(
        defaultPermissionsForNewUser,
        permissionsData?.data ?? [],
      ),
    [defaultPermissionsForNewUser, permissionsData?.data],
  )

  const handleReset = useCallback(() => {
    form.reset(toSignupSettingsFormValues(config))
  }, [config, form])

  const handleSubmit = useCallback(
    async (values: SignupSettingsFormValues) => {
      try {
        const res = await mutateAsync(buildSignupSettingsSavePayload(values))
        if (!res.isSuccess) return showErrorToast({ errors: res.errors })
        showSuccessToast({ description: "Signup settings updated successfully" })
      } catch (error) {
        if (isErrorWithErrors(error)) return showErrorToast({ errors: error.errors })
        showErrorToast({ errors: "Something went wrong" })
      }
    },
    [mutateAsync],
  )

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
  )

  return (
    <div className="w-full min-w-0">
      <Form {...form}>
        <SettingsTabActions tabId="signup-settings">{tabActions}</SettingsTabActions>
        <form className="flex flex-col gap-6" onSubmit={form.handleSubmit(handleSubmit)}>
          <FormField
            name="isEmailPasswordSignUpEnabled"
            control={form.control}
            render={({ field }) => (
              <ToggleCard
                label="Sign Up Enabled"
                description="Allow users to register with email and password. SSO sign-up is enabled automatically when this is on."
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />

          <div className="flex flex-col gap-6">
            <FormField
              name="defaultRolesForNewUser"
              control={form.control}
              render={({ field }) => (
                <SignupRolesSection
                  roles={displayRoles}
                  readOnly={!isEmailPasswordSignUpEnabled}
                  onChange={(roles) => field.onChange(roles.map((role) => role.slug))}
                />
              )}
            />
            <FormField
              name="defaultPermissionsForNewUser"
              control={form.control}
              render={({ field }) => (
                <SignupPermissionsSection
                  permissions={displayPermissions}
                  readOnly={!isEmailPasswordSignUpEnabled}
                  onChange={(permissions) =>
                    field.onChange(permissions.map((permission) => permission.name))
                  }
                />
              )}
            />
          </div>
        </form>
      </Form>
    </div>
  )
}
