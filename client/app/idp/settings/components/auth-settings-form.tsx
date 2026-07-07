import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { Input } from "@/components/ui-kits/input/input";
import {
  showErrorToast,
  showSuccessToast,
} from "@seliseblocks/blocks-kit/utils";
import { isErrorWithErrors } from "@/lib/error";
import { cn } from "@/lib/utils";
import { UrlWithActions } from "@blocks-idp/authentication/pages/authentication-config/general/settings/url-with-actions";
import { SettingsFieldGrid } from "@blocks-idp/settings/components/settings-field-grid";
import { SettingsFormSection } from "@blocks-idp/settings/components/settings-form-section";
import {
  SettingsFormTabButtons,
  SettingsTabActions,
} from "@blocks-idp/settings/components/settings-tab-actions";
import { SETTINGS_FORM_LAYOUT } from "@blocks-idp/settings/constants/settings-form-layout";
import { useSaveSettingsAuthConfig } from "@blocks-idp/settings/hooks/use-settings-config";
import type { ISettingsAuthConfig } from "@blocks-idp/settings/models/settings.model";
import {
  authSettingsFormSchema,
  buildSavePayload,
  toAuthSettingsFormValues,
  type AuthSettingsFormValues,
} from "@blocks-idp/settings/utils/auth-config-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useMemo } from "react";
import { useForm, useFormState } from "react-hook-form";

type AuthSettingsFormProps = {
  config: ISettingsAuthConfig;
};

type MinutesInputProps = {
  value: number;
  onChange: (value: number) => void;
  onBlur: () => void;
  name: string;
};

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
      )}>
      Minutes
    </span>
  </div>
);

export const AuthSettingsForm = ({ config }: AuthSettingsFormProps) => {
  const { mutateAsync, isPending } = useSaveSettingsAuthConfig();

  const formValues = useMemo(() => toAuthSettingsFormValues(config), [config]);

  const form = useForm<AuthSettingsFormValues>({
    values: formValues,
    resolver: zodResolver(authSettingsFormSchema),
  });

  const { isDirty } = useFormState({ control: form.control });

  const handleReset = useCallback(() => {
    form.reset(toAuthSettingsFormValues(config));
  }, [config, form]);

  const handleSubmit = useCallback(
    async (values: AuthSettingsFormValues) => {
      try {
        const payload = buildSavePayload(config, {
          ...values,
          publicCertificatePath: config.publicCertificatePath,
        });
        const res = await mutateAsync(payload);
        if (!res.isSuccess) return showErrorToast({ errors: res.errors });
        showSuccessToast({
          description: "Authentication settings updated successfully",
        });
      } catch (error) {
        if (isErrorWithErrors(error))
          return showErrorToast({ errors: error.errors });
        showErrorToast({ errors: "Something went wrong" });
      }
    },
    [config, mutateAsync],
  );

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
        <SettingsTabActions tabId="auth-config">
          {tabActions}
        </SettingsTabActions>
        <form
          className={SETTINGS_FORM_LAYOUT.formStack}
          onSubmit={form.handleSubmit(handleSubmit)}>
          <SettingsFormSection title="Token Configurations">
            <SettingsFieldGrid>
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
            </SettingsFieldGrid>
          </SettingsFormSection>

          <SettingsFormSection title="Security & Lockout">
            <SettingsFieldGrid>
              <FormField
                name="getNumberOfWrongAttemptsToLockTheAccount"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum Failed Login Attempts</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        className={SETTINGS_FORM_LAYOUT.inputFull}
                        {...field}
                      />
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
            </SettingsFieldGrid>
          </SettingsFormSection>

          <SettingsFormSection title="Infrastructure">
            <FormField
              name="publicCertificatePath"
              control={form.control}
              render={() => (
                <FormItem>
                  <FormControl>
                    <UrlWithActions url={config.publicCertificatePath} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingsFormSection>
        </form>
      </Form>
    </div>
  );
};
