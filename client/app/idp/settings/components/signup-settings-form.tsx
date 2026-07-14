import {
  Form,
  FormField,
} from "@/components/ui-kits/form/form"
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast"
import { isErrorWithErrors } from "@/lib/error"
import { SignupPermissionsSection } from "@blocks-idp/settings/components/signup-permissions-section"
import { SignupRolesSection } from "@blocks-idp/settings/components/signup-roles-section"
import { SettingsToggleCard } from "@blocks-idp/settings/components/settings-toggle-card"
import { useGetPermissions } from "@blocks-idp/iam/hooks/use-permission"
import { useGetRoles } from "@blocks-idp/iam/hooks/use-roles"
import {
  SettingsFormTabButtons,
  SettingsTabActions,
} from "@blocks-idp/settings/components/settings-tab-actions"
import { SETTINGS_FORM_LAYOUT } from "@blocks-idp/settings/constants/settings-form-layout"
import { useSaveSettingsSignUpSetting } from "@blocks-idp/settings/hooks/use-settings-config"
import { useSettingsTenantId } from "@blocks-idp/settings/hooks/use-settings-tenant-id"
import type { ISettingsSignupConfig } from "@blocks-idp/settings/models/settings.model"
import {
  applySignupDisabledOverrides,
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

/**
 * react-hook-form merges useForm's `resetOptions` into every explicit `reset()` call, so the
 * `keepDirtyValues` we need for background refetches would otherwise make `reset()` retain the
 * edits it is meant to discard. Every deliberate reset has to opt out of it.
 */
const DISCARD_DIRTY_VALUES = { keepDirtyValues: false } as const

export const SignupSettingsForm = ({ config }: SignupSettingsFormProps) => {
  const tenantId = useSettingsTenantId()
  const { mutateAsync, isPending } = useSaveSettingsSignUpSetting()

  const formValues = useMemo(() => toSignupSettingsFormValues(config), [config])

  const form = useForm<SignupSettingsFormValues>({
    values: formValues,
    // Without this, a background refetch (window focus, cache invalidation) re-runs the
    // `values` sync, discarding unsaved edits and clearing isDirty — which disables Save.
    resetOptions: { keepDirtyValues: true },
    resolver: zodResolver(signupSettingsFormSchema),
  })

  const { isDirty } = useFormState({ control: form.control })
  const isEmailPasswordSignUpEnabled = form.watch("isEmailPasswordSignUpEnabled")
  const shouldLoadAssignments = isEmailPasswordSignUpEnabled && Boolean(tenantId)

  const { data: rolesData } = useGetRoles(
    {
      page: 0,
      pageSize: 1000,
      sort: { property: "Name", isDescending: false },
      filter: { search: "" },
    },
    { enabled: shouldLoadAssignments },
  )

  const { data: permissionsData } = useGetPermissions(
    {
      projectKey: tenantId,
      page: 0,
      pageSize: 1000,
      search: "",
      isBuiltIn: "",
      roles: [],
      sort: { property: "Name", isDescending: false },
    },
    { enabled: shouldLoadAssignments },
  )
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

  const removedRoles = useMemo(
    () =>
      resolveSignupRoles(
        config.defaultRolesForNewUser.filter(
          (slug) => !defaultRolesForNewUser.includes(slug),
        ),
        rolesData?.data ?? [],
      ),
    [config.defaultRolesForNewUser, defaultRolesForNewUser, rolesData?.data],
  )

  const removedPermissions = useMemo(
    () =>
      resolveSignupPermissions(
        config.defaultPermissionsForNewUser.filter(
          (name) => !defaultPermissionsForNewUser.includes(name),
        ),
        permissionsData?.data ?? [],
      ),
    [
      config.defaultPermissionsForNewUser,
      defaultPermissionsForNewUser,
      permissionsData?.data,
    ],
  )

  const handleReset = useCallback(() => {
    form.reset(toSignupSettingsFormValues(config), DISCARD_DIRTY_VALUES)
  }, [config, form])

  const handleSignupEnabledChange = useCallback(
    (checked: boolean, onChange: (value: boolean) => void) => {
      onChange(checked)

      if (checked) return

      const backendValues = toSignupSettingsFormValues(config)
      form.setValue("defaultRolesForNewUser", backendValues.defaultRolesForNewUser, {
        shouldDirty: true,
      })
      form.setValue(
        "defaultPermissionsForNewUser",
        backendValues.defaultPermissionsForNewUser,
        { shouldDirty: true },
      )
    },
    [config, form],
  )

  const handleSubmit = useCallback(
    async (values: SignupSettingsFormValues) => {
      try {
        const res = await mutateAsync(buildSignupSettingsSavePayload(values, config))
        if (!res.isSuccess) return showErrorToast({ errors: res.errors })
        form.reset(applySignupDisabledOverrides(values, config), DISCARD_DIRTY_VALUES)
        showSuccessToast({ description: "Signup settings updated successfully" })
      } catch (error) {
        if (isErrorWithErrors(error)) return showErrorToast({ errors: error.errors })
        showErrorToast({ errors: "Something went wrong" })
      }
    },
    [config, form, mutateAsync],
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
    <div className={SETTINGS_FORM_LAYOUT.formRoot}>
      <Form {...form}>
        <SettingsTabActions tabId="signup-settings">{tabActions}</SettingsTabActions>
        <form className={SETTINGS_FORM_LAYOUT.formStack} onSubmit={form.handleSubmit(handleSubmit)}>
          <FormField
            name="isEmailPasswordSignUpEnabled"
            control={form.control}
            render={({ field }) => (
              <SettingsToggleCard
                label="Sign Up Enabled"
                description="Allow users to register using an email address and password. SSO sign-up is enabled automatically when this is on."
                checked={field.value}
                onCheckedChange={(checked) =>
                  handleSignupEnabledChange(checked, field.onChange)
                }
              />
            )}
          />

          {isEmailPasswordSignUpEnabled ? (
            <div className="flex flex-col gap-6">
              <FormField
                name="defaultRolesForNewUser"
                control={form.control}
                render={({ field }) => (
                  <SignupRolesSection
                    roles={displayRoles}
                    removedRoles={removedRoles}
                    savedSlugs={config.defaultRolesForNewUser}
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
                    removedPermissions={removedPermissions}
                    savedNames={config.defaultPermissionsForNewUser}
                    onChange={(permissions) =>
                      field.onChange(permissions.map((permission) => permission.name))
                    }
                  />
                )}
              />
            </div>
          ) : null}
        </form>
      </Form>
    </div>
  )
}
