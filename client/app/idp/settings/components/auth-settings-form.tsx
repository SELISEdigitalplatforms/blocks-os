import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form"
import { Input } from "@/components/ui-kits/input/input"
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast"
import { isErrorWithErrors } from "@/lib/error"
import { cn } from "@/lib/utils"
import { UrlWithActions } from "@blocks-idp/authentication/pages/authentication-config/general/settings/url-with-actions"
import {
  SettingsFormTabButtons,
  SettingsTabActions,
} from "@blocks-idp/settings/components/settings-tab-actions"
import { useSaveSettingsAuthConfig } from "@blocks-idp/settings/hooks/use-settings-config"
import type { ISettingsAuthConfig } from "@blocks-idp/settings/models/settings.model"
import {
  authSettingsFormSchema,
  buildSavePayload,
  toAuthSettingsFormValues,
  type AuthSettingsFormValues,
} from "@blocks-idp/settings/utils/auth-config-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useCallback, useMemo } from "react"
import { useForm, useFormState } from "react-hook-form"

type AuthSettingsFormProps = {
  config: ISettingsAuthConfig
}

type MinutesInputProps = {
  value: number
  onChange: (value: number) => void
  onBlur: () => void
  name: string
}

const MinutesInput = ({ value, onChange, onBlur, name }: MinutesInputProps) => (
  <div className="relative w-full">
    <Input
      type="number"
      min={0}
      name={name}
      value={value}
      onBlur={onBlur}
      onChange={(event) => onChange(Number(event.target.value))}
      className="w-full pr-[5.5rem]"
    />
    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
      Minutes
    </span>
  </div>
)

type FormSectionProps = {
  title: string
  children: React.ReactNode
  className?: string
}

const FormSection = ({ title, children, className }: FormSectionProps) => (
  <Card className={cn(className)}>
    <CardHeader className="mb-4">
      <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
)

export const AuthSettingsForm = ({ config }: AuthSettingsFormProps) => {
  const { mutateAsync, isPending } = useSaveSettingsAuthConfig()

  const formValues = useMemo(() => toAuthSettingsFormValues(config), [config])

  const form = useForm<AuthSettingsFormValues>({
    values: formValues,
    resolver: zodResolver(authSettingsFormSchema),
  })

  const { isDirty } = useFormState({ control: form.control })

  const handleReset = useCallback(() => {
    form.reset(toAuthSettingsFormValues(config))
  }, [config, form])

  const handleSubmit = useCallback(
    async (values: AuthSettingsFormValues) => {
      try {
        const payload = buildSavePayload(config, {
          ...values,
          publicCertificatePath: config.publicCertificatePath,
        })
        const res = await mutateAsync(payload)
        if (!res.isSuccess) return showErrorToast({ errors: res.errors })
        showSuccessToast({ description: "Authentication settings updated successfully" })
      } catch (error) {
        if (isErrorWithErrors(error)) return showErrorToast({ errors: error.errors })
        showErrorToast({ errors: "Something went wrong" })
      }
    },
    [config, mutateAsync],
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
        <SettingsTabActions tabId="auth-config">{tabActions}</SettingsTabActions>
        <form className="flex flex-col gap-6" onSubmit={form.handleSubmit(handleSubmit)}>
          <FormSection title="Token Configurations">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                name="accessTokenValidForNumberMinutes"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Access Token Validity</FormLabel>
                    <FormControl>
                      <MinutesInput
                        name={field.name}
                        value={field.value}
                        onBlur={field.onBlur}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="refreshTokenValidForNumberMinutes"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Refresh Token Validity</FormLabel>
                    <FormControl>
                      <MinutesInput
                        name={field.name}
                        value={field.value}
                        onBlur={field.onBlur}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="absoluteRefreshTokenValidForNumberMinutes"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Absolute Refresh Token Validity</FormLabel>
                    <FormControl>
                      <MinutesInput
                        name={field.name}
                        value={field.value}
                        onBlur={field.onBlur}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="rememberMeRefreshTokenValidForNumberMinutes"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remember Me Refresh Token Validity</FormLabel>
                    <FormControl>
                      <MinutesInput
                        name={field.name}
                        value={field.value}
                        onBlur={field.onBlur}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </FormSection>

          <FormSection title="Security & Lockout">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                name="getNumberOfWrongAttemptsToLockTheAccount"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Wrong Login Attempts</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} className="w-full" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="accountLockDurationInMinutes"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Lock Duration</FormLabel>
                    <FormControl>
                      <MinutesInput
                        name={field.name}
                        value={field.value}
                        onBlur={field.onBlur}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </FormSection>

          <FormSection title="Infrastructure">
            <FormField
              name="publicCertificatePath"
              control={form.control}
              render={() => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">Public Certificate</FormLabel>
                  <FormControl>
                    <UrlWithActions url={config.publicCertificatePath} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormSection>
        </form>
      </Form>
    </div>
  )
}
