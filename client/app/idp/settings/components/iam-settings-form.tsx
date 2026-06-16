import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form"
import { Input } from "@/components/ui-kits/input/input"
import { Switch } from "@/components/ui-kits/switch/switch"
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast"
import { isErrorWithErrors } from "@/lib/error"
import { cn } from "@/lib/utils"
import {
  SettingsFormTabButtons,
  SettingsTabActions,
} from "@blocks-idp/settings/components/settings-tab-actions"
import { useSaveSettingsAuthConfig } from "@blocks-idp/settings/hooks/use-settings-config"
import type { ISettingsAuthConfig } from "@blocks-idp/settings/models/settings.model"
import {
  buildSavePayload,
  iamConfigFormSchema,
  toIamConfigFormValues,
  type IamConfigFormValues,
} from "@blocks-idp/settings/utils/auth-config-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Link2, Timer } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useCallback, useMemo } from "react"
import { useForm, useFormState } from "react-hook-form"

type IamSettingsFormProps = {
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

type AccountActionBaseUrlInputProps = {
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  name: string
}

const stripUrlProtocol = (value: string) => value.replace(/^https?:\/\//, "")

const toHttpsUrl = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

const AccountActionBaseUrlInput = ({
  value,
  onChange,
  onBlur,
  name,
}: AccountActionBaseUrlInputProps) => (
  <div className="flex w-full min-w-0 overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
    <span className="flex shrink-0 items-center border-r border-input bg-muted px-3 text-sm text-muted-foreground">
      https://
    </span>
    <Input
      name={name}
      value={stripUrlProtocol(value)}
      onBlur={onBlur}
      onChange={(event) => onChange(toHttpsUrl(event.target.value))}
      className="min-w-0 flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
      placeholder="console.enterprise.cloud"
    />
  </div>
)

type FormSectionProps = {
  title: string
  icon?: LucideIcon
  children: React.ReactNode
  className?: string
}

const FormSection = ({ title, icon: Icon, children, className }: FormSectionProps) => (
  <Card className={cn(className)}>
    <CardHeader className="mb-4">
      <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden /> : null}
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
)

type SwitchRowProps = {
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}

const ToggleCard = ({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: SwitchRowProps) => (
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

const SwitchRow = ({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: SwitchRowProps) => (
  <FormItem className="flex flex-col gap-3 space-y-0 rounded-md border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
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
)

export const IamSettingsForm = ({ config }: IamSettingsFormProps) => {
  const { mutateAsync, isPending } = useSaveSettingsAuthConfig()

  const formValues = useMemo(() => toIamConfigFormValues(config), [config])

  const form = useForm<IamConfigFormValues>({
    values: formValues,
    resolver: zodResolver(iamConfigFormSchema),
  })

  const { isDirty } = useFormState({ control: form.control })
  const isOidcEnabled = form.watch("isOidcEnabled")

  const handleReset = useCallback(() => {
    form.reset(toIamConfigFormValues(config))
  }, [config, form])

  const handleSubmit = useCallback(
    async (values: IamConfigFormValues) => {
      try {
        const payload = buildSavePayload(config, values)
        const res = await mutateAsync(payload)
        if (!res.isSuccess) return showErrorToast({ errors: res.errors })
        showSuccessToast({ description: "IAM configuration updated successfully" })
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
        <SettingsTabActions tabId="iam-config">{tabActions}</SettingsTabActions>
        <form className="flex flex-col gap-6" onSubmit={form.handleSubmit(handleSubmit)}>
          <FormField
            name="isOidcEnabled"
            control={form.control}
            render={({ field }) => (
              <ToggleCard
                label="OpenID Connect (OIDC)"
                description="When enabled, account activation and recovery flows use your OIDC provider instead of custom redirect paths."
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />

          {!isOidcEnabled ? (
            <FormSection title="Activation & Recovery Paths" icon={Link2}>
              <div className="space-y-4">
                <FormField
                  name="accountActivationPath"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Activation Path</FormLabel>
                      <FormControl>
                        <Input className="w-full" placeholder="/auth/activate-account" {...field} />
                      </FormControl>
                      <FormDescription>Redirect URL for initial user activation flows.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    name="accountVerificationPath"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Verification Path</FormLabel>
                        <FormControl>
                          <Input className="w-full" placeholder="/auth/verify-identity" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="recoverAccountPath"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Recover Account Path</FormLabel>
                        <FormControl>
                          <Input className="w-full" placeholder="/auth/recovery" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="space-y-3 rounded-md border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium leading-none">Account Action Base URL</p>
                      <p className="text-sm text-muted-foreground">
                        Activation, verification, and recovery links use this host as the default prefix when enabled.
                      </p>
                    </div>
                    <FormField
                      name="useAccountActionBaseUrlAsDefault"
                      control={form.control}
                      render={({ field }) => (
                        <FormItem className="flex shrink-0 items-center gap-2 space-y-0 self-start sm:self-center">
                          <FormLabel
                            htmlFor="use-account-action-base-url-as-default"
                            className="!mt-0 cursor-pointer text-sm font-normal text-muted-foreground"
                          >
                            Use as default
                          </FormLabel>
                          <FormControl>
                            <Switch
                              id="use-account-action-base-url-as-default"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              aria-label="Use account action base URL as default"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    name="accountActionBaseUrl"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <AccountActionBaseUrlInput
                            name={field.name}
                            value={field.value}
                            onBlur={field.onBlur}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage className="mt-2" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </FormSection>
          ) : null}

          <FormSection title="Expiration Lifetimes" icon={Timer}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                name="activationUrlLifetimeInMinutes"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Activation URL Lifetime</FormLabel>
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
                name="recoverAccountUrlLifetimeInMinutes"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recover Account URL Lifetime</FormLabel>
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

          <FormSection title="Security">
            <div className="space-y-4">
              <FormField
                name="logoutOnPasswordChange"
                control={form.control}
                render={({ field }) => (
                  <SwitchRow
                    label="Logout on Password Change"
                    description="Sign users out of all active sessions when their password is changed."
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <FormField
                name="passwordStrengthCheckerRegex"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password Strength Regex</FormLabel>
                    <FormControl>
                      <Input className="w-full font-mono text-sm" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </FormSection>
        </form>
      </Form>
    </div>
  )
}
