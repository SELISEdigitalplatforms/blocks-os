import { useEffect, useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { FormDescription, FormLabel } from "@/components/ui-kits/form/form";
import { Label } from "@/components/ui-kits/label/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui-kits/radio-group/radio-group";
import { cn } from "@/lib/utils";
import { tStatic, useT } from "@seliseblocks/genesis-os";
import { useGetIdentityProviders } from "@blocks-idp/authentication/hooks/use-identity-provider";
import { useGetTenantLoginPolicy } from "@blocks-idp/authentication/hooks/use-login-policy";
import type {
  OidcLoginMethod,
  OidcLoginProviders,
} from "@blocks-idp/authentication/models/login-policy.model";
import type { IdentityProvider } from "@blocks-idp/authentication/models/identity-provider.model";
import { usesSocialProviders, type CreateOIDCFormValues } from "./utils";

type Option<T extends string> = { value: T; id: string; label: string; hint: string };

const getMethodOptions = (): Option<OidcLoginMethod>[] => [
  {
    value: "default",
    id: "loginMethod-default",
    label: tStatic("os.idp.create-oidc", "OIDC_SIGN_IN_SECTION.OPTION_DEFAULT"),
    hint: tStatic("os.idp.create-oidc", "OIDC_SIGN_IN_SECTION.METHOD_DEFAULT_HINT"),
  },
  {
    value: "password",
    id: "loginMethod-password",
    label: tStatic("os.idp.create-oidc", "OIDC_SIGN_IN_SECTION.METHOD_PASSWORD"),
    hint: tStatic("os.idp.create-oidc", "OIDC_SIGN_IN_SECTION.METHOD_PASSWORD_HINT"),
  },
  {
    value: "social",
    id: "loginMethod-social",
    label: tStatic("os.idp.create-oidc", "OIDC_SIGN_IN_SECTION.METHOD_SOCIAL"),
    hint: tStatic("os.idp.create-oidc", "OIDC_SIGN_IN_SECTION.METHOD_SOCIAL_HINT"),
  },
];

const getProviderOptions = (): Option<OidcLoginProviders>[] => [
  {
    value: "default",
    id: "loginProviders-default",
    label: tStatic("os.idp.create-oidc", "OIDC_SIGN_IN_SECTION.OPTION_DEFAULT"),
    hint: tStatic("os.idp.create-oidc", "OIDC_SIGN_IN_SECTION.PROVIDERS_DEFAULT_HINT"),
  },
  {
    value: "selected",
    id: "loginProviders-selected",
    label: tStatic("os.idp.create-oidc", "OIDC_SIGN_IN_SECTION.PROVIDERS_SELECTED"),
    hint: tStatic("os.idp.create-oidc", "OIDC_SIGN_IN_SECTION.PROVIDERS_SELECTED_HINT"),
  },
];

const isSocialAndActive = (provider: IdentityProvider) =>
  provider.providerType === "social" && provider.isActive;

type OptionCardsProps<T extends string> = {
  label: string;
  value: T;
  options: Option<T>[];
  isDisabled?: (value: T) => boolean;
  onChange: (value: T) => void;
};

const OptionCards = <T extends string>({
  label,
  value,
  options,
  isDisabled,
  onChange,
}: Readonly<OptionCardsProps<T>>) => {
  const { t } = useT("os.idp.create-oidc");
  return (
    <RadioGroup aria-label={label} value={value} onValueChange={(next) => onChange(next as T)}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {options.map((option) => {
          const disabled = isDisabled?.(option.value) ?? false;
          return (
            <div
              key={option.value}
              className={cn(
                "flex items-start gap-2 rounded-md border p-3",
                value === option.value ? "border-primary bg-primary/5" : "border-input",
                disabled && "opacity-60",
              )}
            >
              <RadioGroupItem
                value={option.value}
                id={option.id}
                disabled={disabled}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <Label htmlFor={option.id} className="cursor-pointer text-sm">
                  {option.label}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {disabled ? t("OIDC_SIGN_IN_SECTION.TURNED_OFF_NOTE") : option.hint}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </RadioGroup>
  );
};

type ProviderChecklistProps = {
  providers: IdentityProvider[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

const ProviderChecklist = ({
  providers,
  selectedIds,
  onChange,
}: Readonly<ProviderChecklistProps>) => {
  const { t } = useT("os.idp.create-oidc");
  if (providers.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">{t("OIDC_SIGN_IN_SECTION.NO_PROVIDERS")}</p>
    );
  }
  const toggle = (id: string, checked: boolean) =>
    onChange(checked ? [...selectedIds, id] : selectedIds.filter((existing) => existing !== id));

  return (
    <ul className="space-y-2 rounded-md border p-3">
      {providers.map((provider) => {
        const id = provider.itemId ?? provider.provider;
        const inputId = `loginProvider-${id}`;
        return (
          <li key={id} className="flex items-center gap-2">
            <Checkbox
              id={inputId}
              checked={selectedIds.includes(id)}
              onCheckedChange={(checked) => toggle(id, checked === true)}
            />
            <Label htmlFor={inputId} className="cursor-pointer text-sm">
              {provider.displayName}
              <span className="ml-2 text-xs text-muted-foreground">{provider.provider}</span>
            </Label>
          </li>
        );
      })}
    </ul>
  );
};

type OidcSignInSectionProps = {
  form: UseFormReturn<CreateOIDCFormValues>;
  tenantId: string;
};

/** Per-client sign-in rule: the method, and which social providers it may use. */
export const OidcSignInSection = ({ form, tenantId }: Readonly<OidcSignInSectionProps>) => {
  const { t } = useT("os.idp.create-oidc");
  const method = form.watch("loginMethod");
  const providersMode = form.watch("loginProviders");
  const selectedIds = form.watch("loginProviderIds");
  const showProviders = usesSocialProviders(method);

  const { data: tenantPolicy } = useGetTenantLoginPolicy();
  const { data: providerData } = useGetIdentityProviders({ projectId: tenantId });
  const providersLoaded = providerData !== undefined;
  const socialProviders = useMemo(
    () => (providerData?.data ?? []).filter(isSocialAndActive),
    [providerData],
  );

  // A provider that was removed or switched off since the policy was saved must not stay
  // selected: the server refuses unknown ids.
  useEffect(() => {
    if (!providersLoaded) return;
    const known = new Set(socialProviders.map((provider) => provider.itemId));
    const kept = selectedIds.filter((id) => known.has(id));
    if (kept.length !== selectedIds.length) {
      form.setValue("loginProviderIds", kept, { shouldValidate: true });
    }
  }, [providersLoaded, socialProviders, selectedIds, form]);

  const providerError = form.formState.errors.loginProviderIds?.message;
  const policy = tenantPolicy?.loginPolicy;
  const isMethodDisabled = (value: OidcLoginMethod) =>
    (value === "password" && policy?.allowPassword === false) ||
    (value === "social" && policy?.allowSocial === false);

  const handleMethodChange = (next: OidcLoginMethod) => {
    form.setValue("loginMethod", next, { shouldDirty: true, shouldValidate: true });
    void form.trigger("loginProviderIds");
  };

  const handleProvidersChange = (next: OidcLoginProviders) => {
    form.setValue("loginProviders", next, { shouldDirty: true });
    // The "pick one" error belongs to the id list, so that field is the one to re-check.
    void form.trigger("loginProviderIds");
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <FormLabel>{t("OIDC_SIGN_IN_SECTION.SIGN_IN")}</FormLabel>
        <FormDescription className="text-xs">{t("OIDC_SIGN_IN_SECTION.METHOD")}</FormDescription>
        <OptionCards
          label={t("OIDC_SIGN_IN_SECTION.SIGN_IN_METHOD")}
          value={method}
          options={getMethodOptions()}
          isDisabled={isMethodDisabled}
          onChange={handleMethodChange}
        />
      </div>
      {showProviders && (
        <div className="space-y-2">
          <FormDescription className="text-xs">
            {t("OIDC_SIGN_IN_SECTION.SOCIAL_PROVIDERS")}
          </FormDescription>
          <OptionCards
            label={t("OIDC_SIGN_IN_SECTION.SOCIAL_PROVIDERS")}
            value={providersMode}
            options={getProviderOptions()}
            onChange={handleProvidersChange}
          />
          {providersMode === "selected" && (
            <ProviderChecklist
              providers={socialProviders}
              selectedIds={selectedIds}
              onChange={(ids) =>
                form.setValue("loginProviderIds", ids, { shouldDirty: true, shouldValidate: true })
              }
            />
          )}
          {providerError && <p className="text-xs text-destructive">{providerError}</p>}
        </div>
      )}
    </div>
  );
};
