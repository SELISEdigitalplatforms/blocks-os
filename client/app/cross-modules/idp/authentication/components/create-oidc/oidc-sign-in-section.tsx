import { useEffect, useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";
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
import {
  SOCIAL_AUTH_PROVIDERS_CONFIG,
  SSO_PROVIDERS,
} from "@blocks-idp/authentication/constants/sso-providers.constant";
import { microsoftTenantOf } from "../identity-provider/identity-provider-form.util";
import { maskId } from "../../utils/mask-id.util";
import { usesSocialProviders, type CreateOIDCFormValues } from "./utils";

const I18N_MODULE = "os.idp.create-oidc";

type Option<T extends string> = { value: T; id: string; label: string; hint: string };

const getMethodOptions = (): Option<OidcLoginMethod>[] => [
  {
    value: "default",
    id: "loginMethod-default",
    label: tStatic(I18N_MODULE, "OIDC_SIGN_IN_SECTION.OPTION_DEFAULT"),
    hint: tStatic(I18N_MODULE, "OIDC_SIGN_IN_SECTION.METHOD_DEFAULT_HINT"),
  },
  {
    value: "password",
    id: "loginMethod-password",
    label: tStatic(I18N_MODULE, "OIDC_SIGN_IN_SECTION.METHOD_PASSWORD"),
    hint: tStatic(I18N_MODULE, "OIDC_SIGN_IN_SECTION.METHOD_PASSWORD_HINT"),
  },
  {
    value: "social",
    id: "loginMethod-social",
    label: tStatic(I18N_MODULE, "OIDC_SIGN_IN_SECTION.METHOD_SOCIAL"),
    hint: tStatic(I18N_MODULE, "OIDC_SIGN_IN_SECTION.METHOD_SOCIAL_HINT"),
  },
];

const getProviderOptions = (): Option<OidcLoginProviders>[] => [
  {
    value: "default",
    id: "loginProviders-default",
    label: tStatic(I18N_MODULE, "OIDC_SIGN_IN_SECTION.OPTION_DEFAULT"),
    hint: tStatic(I18N_MODULE, "OIDC_SIGN_IN_SECTION.PROVIDERS_DEFAULT_HINT"),
  },
  {
    value: "selected",
    id: "loginProviders-selected",
    label: tStatic(I18N_MODULE, "OIDC_SIGN_IN_SECTION.PROVIDERS_SELECTED"),
    hint: tStatic(I18N_MODULE, "OIDC_SIGN_IN_SECTION.PROVIDERS_SELECTED_HINT"),
  },
];

const isSocial = (provider: IdentityProvider) => provider.providerType === "social";

const NONE = "none";

type ProviderGroup = { provider: string; label: string; entries: IdentityProvider[] };

/** Social entries by provider (Google, Microsoft, …), in the order the API lists them. */
const groupByProvider = (providers: IdentityProvider[]): ProviderGroup[] => {
  const groups = new Map<string, IdentityProvider[]>();
  providers.forEach((entry) =>
    groups.set(entry.provider, [...(groups.get(entry.provider) ?? []), entry]),
  );
  return [...groups.entries()].map(([provider, entries]) => ({
    provider,
    label: SOCIAL_AUTH_PROVIDERS_CONFIG[provider as SSO_PROVIDERS]?.label ?? provider,
    entries,
  }));
};

const entryHint = (entry: IdentityProvider): string => {
  const parts = [
    tStatic(I18N_MODULE, "OIDC_SIGN_IN_SECTION.ENTRY_CLIENT", { clientId: maskId(entry.clientId) }),
  ];
  const tenant = microsoftTenantOf(entry.wellKnownUrl);
  if (tenant) parts.push(tStatic(I18N_MODULE, "OIDC_SIGN_IN_SECTION.ENTRY_TENANT", { tenant }));
  return parts.join(" · ");
};

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
  const { t } = useT(I18N_MODULE);
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

type ProviderOptionProps = Readonly<{
  id: string;
  value: string;
  title: string;
  hint: string;
  selected: boolean;
  disabled?: boolean;
}>;

const ProviderOption = ({
  id,
  value,
  title,
  hint,
  selected,
  disabled = false,
}: ProviderOptionProps) => {
  const { t } = useT(I18N_MODULE);
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border p-3",
        selected ? "border-primary bg-primary/5" : "border-input",
        disabled && "opacity-60",
      )}
    >
      <RadioGroupItem value={value} id={id} disabled={disabled} />
      <Label htmlFor={id} className="min-w-0 flex-1 cursor-pointer space-y-0.5">
        <span className="block text-sm">{title}</span>
        <span className="block truncate text-xs font-normal text-muted-foreground">{hint}</span>
      </Label>
      {disabled && (
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {t("OIDC_SIGN_IN_SECTION.ENTRY_TURNED_OFF")}
        </span>
      )}
    </div>
  );
};

type ProviderPickerProps = {
  providers: IdentityProvider[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

/**
 * One choice per provider: the login page shows one button for each, so a client picks which
 * Google and which Microsoft it uses, or none. Switched-off entries are listed but cannot be picked.
 */
const ProviderPicker = ({ providers, selectedIds, onChange }: Readonly<ProviderPickerProps>) => {
  const { t } = useT(I18N_MODULE);
  if (providers.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">{t("OIDC_SIGN_IN_SECTION.NO_PROVIDERS")}</p>
    );
  }
  const pick = (group: ProviderGroup, value: string) => {
    const groupIds = new Set(group.entries.map((entry) => entry.itemId));
    const others = selectedIds.filter((id) => !groupIds.has(id));
    onChange(value === NONE ? others : [...others, value]);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {t("OIDC_SIGN_IN_SECTION.PICK_ONE_PER_PROVIDER")}
      </p>
      {groupByProvider(providers).map((group) => {
        const current =
          group.entries.find((entry) => entry.itemId && selectedIds.includes(entry.itemId))
            ?.itemId ?? NONE;
        return (
          <fieldset key={group.provider} className="space-y-2 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium text-high-emphasis">{group.label}</legend>
            <RadioGroup
              aria-label={group.label}
              value={current}
              onValueChange={(value) => pick(group, value)}
              className="gap-2"
            >
              <ProviderOption
                id={`loginProvider-${group.provider}-${NONE}`}
                value={NONE}
                title={t("OIDC_SIGN_IN_SECTION.DONT_OFFER", { provider: group.label })}
                hint={t("OIDC_SIGN_IN_SECTION.DONT_OFFER_HINT", { provider: group.label })}
                selected={current === NONE}
              />
              {group.entries.map((entry) => (
                <ProviderOption
                  key={entry.itemId}
                  id={`loginProvider-${entry.itemId}`}
                  value={entry.itemId ?? ""}
                  title={entry.displayName || entry.provider}
                  hint={entryHint(entry)}
                  selected={current === entry.itemId}
                  disabled={!entry.isActive}
                />
              ))}
            </RadioGroup>
          </fieldset>
        );
      })}
    </div>
  );
};

/**
 * Default offers every active entry. The IAM login page shows one button per provider, so where a
 * provider has several, only its oldest is offered there: this says so, and how to choose.
 */
const SeveralEntriesNote = ({ providers }: Readonly<{ providers: IdentityProvider[] }>) => {
  const { t } = useT(I18N_MODULE);
  const repeated = groupByProvider(providers.filter((entry) => entry.isActive)).filter(
    (group) => group.entries.length > 1,
  );
  if (repeated.length === 0) return null;
  return (
    <div className="space-y-1 rounded-md border border-dashed bg-muted/40 p-3">
      {repeated.map((group) => (
        <p key={group.provider} className="text-xs text-muted-foreground">
          {t("OIDC_SIGN_IN_SECTION.DEFAULT_SEVERAL_ENTRIES", {
            provider: group.label,
            count: group.entries.length,
          })}
        </p>
      ))}
    </div>
  );
};

type OidcSignInSectionProps = {
  form: UseFormReturn<CreateOIDCFormValues>;
  tenantId: string;
  /** The edit page shows "Sign-in" as its section heading instead. */
  showLabel?: boolean;
};

/** Per-client sign-in rule: the method, and which social providers it may use. */
export const OidcSignInSection = ({
  form,
  tenantId,
  showLabel = true,
}: Readonly<OidcSignInSectionProps>) => {
  const { t } = useT(I18N_MODULE);
  const method = form.watch("loginMethod");
  const providersMode = form.watch("loginProviders");
  const selectedIds = form.watch("loginProviderIds");
  const showProviders = usesSocialProviders(method);

  const { data: tenantPolicy } = useGetTenantLoginPolicy();
  const { data: providerData } = useGetIdentityProviders({ projectId: tenantId });
  const providersLoaded = providerData !== undefined;
  const socialProviders = useMemo(
    () => (providerData?.data ?? []).filter(isSocial),
    [providerData],
  );

  // A provider that was removed or switched off since the policy was saved must not stay
  // selected: the server refuses unknown ids.
  useEffect(() => {
    if (!providersLoaded) return;
    const known = new Set(
      socialProviders.filter((provider) => provider.isActive).map((provider) => provider.itemId),
    );
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
        {showLabel && <FormLabel>{t("OIDC_SIGN_IN_SECTION.SIGN_IN")}</FormLabel>}
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
          {providersMode === "selected" ? (
            <ProviderPicker
              providers={socialProviders}
              selectedIds={selectedIds}
              onChange={(ids) =>
                form.setValue("loginProviderIds", ids, { shouldDirty: true, shouldValidate: true })
              }
            />
          ) : (
            <SeveralEntriesNote providers={socialProviders} />
          )}
          {providerError && <p className="text-xs text-destructive">{providerError}</p>}
        </div>
      )}
    </div>
  );
};
