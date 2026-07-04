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
import { SettingsFieldGrid } from "@blocks-idp/settings/components/settings-field-grid"
import { SettingsFormSection } from "@blocks-idp/settings/components/settings-form-section"
import {
  SettingsFormTabButtons,
  SettingsTabActions,
} from "@blocks-idp/settings/components/settings-tab-actions"
import { SettingsToggleCard } from "@blocks-idp/settings/components/settings-toggle-card"
import { SETTINGS_FORM_LAYOUT } from "@blocks-idp/settings/constants/settings-form-layout"
import { useSaveSettingsAuthConfig } from "@blocks-idp/settings/hooks/use-settings-config"
import type { ISettingsAuthConfig } from "@blocks-idp/settings/models/settings.model"
import {
  applyOidcIamConfigOverrides,
  buildSavePayload,
  DEFAULT_PASSWORD_STRENGTH_REGEX_PLACEHOLDER,
  getBlocksIamBaseUrl,
  iamConfigFormSchema,
  toIamConfigFormValues,
  type IamConfigFormValues,
} from "@blocks-idp/settings/utils/auth-config-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useCallback, useEffect, useMemo } from "react"
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
      className={SETTINGS_FORM_LAYOUT.inputWithSuffix}
    />
    <span
      className={cn(
        "pointer-events-none absolute inset-y-0 right-3 flex items-center",
        SETTINGS_FORM_LAYOUT.inputSuffix,
      )}
    >
      Minutes
    </span>
  </div>
)

type AccountActionBaseUrlInputProps = {
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  name: string
  readOnly?: boolean
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
  readOnly = false,
}: AccountActionBaseUrlInputProps) => (
  <div
    className={cn(
      "flex h-10 w-full min-w-0 overflow-hidden rounded-md border",
      readOnly
        ? "cursor-not-allowed border-muted-foreground/20 bg-muted/80 shadow-none"
        : "border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
    )}
  >
    <span
      className={cn(
        "flex h-full shrink-0 items-center border-r px-3 text-sm",
        readOnly
          ? "border-muted-foreground/20 bg-muted/80 text-muted-foreground"
          : "border-input bg-muted text-muted-foreground",
      )}
    >
      https://
    </span>
    <Input
      name={name}
      value={stripUrlProtocol(value)}
      onBlur={onBlur}
      readOnly={readOnly}
      tabIndex={readOnly ? -1 : undefined}
      aria-readonly={readOnly}
      onChange={(event) => onChange(toHttpsUrl(event.target.value))}
      className={cn(
        "h-full min-w-0 flex-1 rounded-none border-0 py-2 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
        readOnly
          ? "cursor-not-allowed bg-muted/80 text-muted-foreground opacity-100 focus-visible:outline-none"
          : "bg-transparent",
      )}
      placeholder="console.enterprise.cloud"
    />
  </div>
)

type SwitchRowProps = {
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}

const SwitchRow = ({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: SwitchRowProps) => (
  <FormItem
    className={cn(SETTINGS_FORM_LAYOUT.toggleRow, "pb-2")}
  >
    <div className={SETTINGS_FORM_LAYOUT.toggleLabelGroup}>
      <FormLabel className={cn("!mt-0", SETTINGS_FORM_LAYOUT.toggleTitle)}>{label}</FormLabel>
      {description ? (
        <p className={SETTINGS_FORM_LAYOUT.toggleDescription}>{description}</p>
      ) : null}
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
  const blocksIamBaseUrl = useMemo(() => getBlocksIamBaseUrl(), [])

  useEffect(() => {
    if (!isOidcEnabled) return

    const currentUseDefault = form.getValues("useAccountActionBaseUrlAsDefault")

    if (!currentUseDefault) {
      form.setValue("useAccountActionBaseUrlAsDefault", true, { shouldDirty: true })
    }
  }, [form, isOidcEnabled])

  const handleReset = useCallback(() => {
    form.reset(toIamConfigFormValues(config))
  }, [config, form])

  const handleSubmit = useCallback(
    async (values: IamConfigFormValues) => {
      try {
        const payload = buildSavePayload(config, applyOidcIamConfigOverrides(values))
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
    <div className={SETTINGS_FORM_LAYOUT.formRoot}>
      <Form {...form}>
        <SettingsTabActions tabId="iam-config">{tabActions}</SettingsTabActions>
        <form
          className={SETTINGS_FORM_LAYOUT.formStack}
          onSubmit={form.handleSubmit(handleSubmit)}
        >
          <FormField
            name="isOidcEnabled"
            control={form.control}
            render={({ field }) => (
              <SettingsToggleCard
                label="OpenID Connect (OIDC)"
                description="Routes account activation and recovery through your OIDC provider. Path settings are hidden while this is on; account action links use the Blocks IAM base URL."
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />

          <SettingsFormSection title="Activation & Recovery Paths">
            <div className={SETTINGS_FORM_LAYOUT.stackedFields}>
              {!isOidcEnabled ? (
                <>
                  <FormField
                    name="accountActivationPath"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Activation Path</FormLabel>
                        <FormControl>
                          <Input
                            className={SETTINGS_FORM_LAYOUT.inputFull}
                            placeholder="/auth/activate-account"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Redirect URL for initial user activation flows.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <SettingsFieldGrid>
                    <FormField
                      name="accountVerificationPath"
                      control={form.control}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Verification Path</FormLabel>
                          <FormControl>
                            <Input
                              className={SETTINGS_FORM_LAYOUT.inputFull}
                              placeholder="/auth/verify-identity"
                              {...field}
                            />
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
                            <Input
                              className={SETTINGS_FORM_LAYOUT.inputFull}
                              placeholder="/auth/recovery"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </SettingsFieldGrid>
                </>
              ) : null}
              <div className={cn("space-y-3", !isOidcEnabled && "pt-4")}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className={SETTINGS_FORM_LAYOUT.toggleLabelGroup}>
                    <p className={SETTINGS_FORM_LAYOUT.toggleTitle}>Account Action Base URL</p>
                    <p className={SETTINGS_FORM_LAYOUT.toggleDescription}>
                      {isOidcEnabled
                        ? "OIDC account actions use the Blocks IAM base URL."
                        : "Activation, verification, and recovery links use this host as the default prefix."}
                    </p>
                  </div>
                  {!isOidcEnabled ? (
                    <FormField
                      name="useAccountActionBaseUrlAsDefault"
                      control={form.control}
                      render={({ field }) => (
                        <FormItem className="flex shrink-0 items-center gap-2 space-y-0 self-start sm:self-center">
                          <FormLabel
                            htmlFor="use-account-action-base-url-as-default"
                            className="!mt-0 cursor-pointer font-normal text-muted-foreground"
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
                  ) : null}
                </div>
                <FormField
                  name="accountActionBaseUrl"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem className="space-y-0">
                      <FormControl>
                        <AccountActionBaseUrlInput
                          name={field.name}
                          value={
                            isOidcEnabled
                              ? blocksIamBaseUrl
                              : field.value || blocksIamBaseUrl
                          }
                          onBlur={field.onBlur}
                          onChange={field.onChange}
                          readOnly={isOidcEnabled}
                        />
                      </FormControl>
                      <FormMessage className="mt-2" />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </SettingsFormSection>

          <SettingsFormSection title="Expiration Lifetimes">
            <SettingsFieldGrid>
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
            </SettingsFieldGrid>
          </SettingsFormSection>

          <SettingsFormSection title="Security">
            <div className={SETTINGS_FORM_LAYOUT.stackedFields}>
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
                      <Input
                        className={cn(SETTINGS_FORM_LAYOUT.inputFull, "font-mono text-sm")}
                        placeholder={DEFAULT_PASSWORD_STRENGTH_REGEX_PLACEHOLDER}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </SettingsFormSection>
        </form>
      </Form>
    </div>
  )
}
