import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { tStatic, useT } from "@seliseblocks/genesis-os";
import { Info, Plus, X } from "lucide-react";
import { Input } from "@/components/ui-kits/input/input";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { Label } from "@/components/ui-kits/label/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui-kits/radio-group/radio-group";
import { Button } from "@/components/ui-kits/button/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui-kits/tooltip/tooltip";
import type { ISettingsAuthConfig } from "@blocks-idp/settings/models/settings.model";
import {
  ApplicationType,
  describeTokenLifetime,
  formatMinutes,
  knownMinutes,
  TOKEN_LIFETIME_LIMITS,
  type TokenLifetimeFormValues,
} from "./utils";
import type { OidcClientFormController, TokenLifetimeMode } from "./use-oidc-client-form";

const I18N_MODULE = "os.idp.create-oidc";

type FieldProps = Readonly<{ ctl: OidcClientFormController }>;

/** For a field whose title the edit page shows as its section heading instead. */
type LabelledFieldProps = Readonly<{ ctl: OidcClientFormController; showLabel?: boolean }>;

const getApplicationTypeOptions = (): { value: ApplicationType; id: string; label: string }[] => [
  {
    value: "web",
    id: "applicationType-web",
    label: tStatic(I18N_MODULE, "CREATE_OIDC.APP_TYPE_WEB"),
  },
  {
    value: "mobile",
    id: "applicationType-mobile",
    label: tStatic(I18N_MODULE, "CREATE_OIDC.APP_TYPE_MOBILE"),
  },
];

const getApplicationTypeHelper = (): Record<ApplicationType, string> => ({
  web: tStatic(I18N_MODULE, "CREATE_OIDC.APP_TYPE_WEB_HELPER"),
  mobile: tStatic(I18N_MODULE, "CREATE_OIDC.APP_TYPE_MOBILE_HELPER"),
});

const REDIRECT_URI_PLACEHOLDER: Record<ApplicationType, string> = {
  web: "https://example.com/oidc",
  mobile: "com.example.app://callback",
};

type ProjectLifetimeKey =
  | "accessTokenValidForNumberMinutes"
  | "refreshTokenValidForNumberMinutes"
  | "absoluteRefreshTokenValidForNumberMinutes";

type TokenLifetimeField = {
  name: keyof TokenLifetimeFormValues;
  label: string;
  shortLabel: string;
  note: string;
  ariaLabel: string;
  max: number;
  projectKey: ProjectLifetimeKey;
};

const getTokenLifetimeFields = (): TokenLifetimeField[] => [
  {
    name: "accessTokenLifetime",
    label: tStatic(I18N_MODULE, "CREATE_OIDC.LIFETIME_ACCESS_LABEL"),
    shortLabel: tStatic(I18N_MODULE, "CREATE_OIDC.LIFETIME_ACCESS_SHORT"),
    note: tStatic(I18N_MODULE, "CREATE_OIDC.LIFETIME_ACCESS_NOTE"),
    ariaLabel: tStatic(I18N_MODULE, "CREATE_OIDC.LIFETIME_ACCESS_ARIA"),
    max: TOKEN_LIFETIME_LIMITS.access.max,
    projectKey: "accessTokenValidForNumberMinutes",
  },
  {
    name: "refreshTokenLifetime",
    label: tStatic(I18N_MODULE, "CREATE_OIDC.LIFETIME_REFRESH_LABEL"),
    shortLabel: tStatic(I18N_MODULE, "CREATE_OIDC.LIFETIME_REFRESH_SHORT"),
    note: tStatic(I18N_MODULE, "CREATE_OIDC.LIFETIME_REFRESH_NOTE"),
    ariaLabel: tStatic(I18N_MODULE, "CREATE_OIDC.LIFETIME_REFRESH_ARIA"),
    max: TOKEN_LIFETIME_LIMITS.refresh.max,
    projectKey: "refreshTokenValidForNumberMinutes",
  },
  {
    name: "absoluteRefreshTokenLifetime",
    label: tStatic(I18N_MODULE, "CREATE_OIDC.LIFETIME_ABSOLUTE_LABEL"),
    shortLabel: tStatic(I18N_MODULE, "CREATE_OIDC.LIFETIME_ABSOLUTE_SHORT"),
    note: tStatic(I18N_MODULE, "CREATE_OIDC.LIFETIME_ABSOLUTE_NOTE"),
    ariaLabel: tStatic(I18N_MODULE, "CREATE_OIDC.LIFETIME_ABSOLUTE_ARIA"),
    max: TOKEN_LIFETIME_LIMITS.refresh.max,
    projectKey: "absoluteRefreshTokenValidForNumberMinutes",
  },
];

const getTokenModeOptions = (): { value: TokenLifetimeMode; id: string; label: string }[] => [
  {
    value: "project",
    id: "tokenLifetimes-project",
    label: tStatic(I18N_MODULE, "CREATE_OIDC.MODE_PROJECT"),
  },
  {
    value: "custom",
    id: "tokenLifetimes-custom",
    label: tStatic(I18N_MODULE, "CREATE_OIDC.MODE_CUSTOM"),
  },
];

const projectSummary = (config?: ISettingsAuthConfig) => {
  const fallback = tStatic(I18N_MODULE, "CREATE_OIDC.PROJECT_SUMMARY_FALLBACK");
  if (!config) return fallback;
  const parts = getTokenLifetimeFields()
    .map((lifetime) => {
      const minutes = knownMinutes(config[lifetime.projectKey]);
      return minutes === undefined
        ? undefined
        : tStatic(I18N_MODULE, "CREATE_OIDC.PROJECT_SUMMARY_ITEM", {
            label: lifetime.shortLabel,
            value: formatMinutes(minutes),
          });
    })
    .filter(Boolean);
  return parts.length ? parts.join(" · ") : fallback;
};

/** Per-client token lifetimes: the project values, or this client's own values. */
export const TokenLifetimesSection = ({ ctl, showLabel = true }: LabelledFieldProps) => {
  const { t } = useT(I18N_MODULE);
  const { form, tokenMode: mode, setTokenMode: onModeChange, projectConfig } = ctl;
  const lifetimeFields = getTokenLifetimeFields();
  const handleModeChange = (next: TokenLifetimeMode) => {
    onModeChange(next);
    lifetimeFields.forEach((lifetime) => {
      // Custom starts from the project values; project clears this client's values.
      const projectMinutes = knownMinutes(projectConfig?.[lifetime.projectKey]);
      const startValue =
        next === "custom" && projectMinutes !== undefined ? String(projectMinutes) : "";
      const keepTyped = next === "custom" && form.getValues(lifetime.name).trim() !== "";
      if (!keepTyped) {
        form.setValue(lifetime.name, startValue, { shouldDirty: true, shouldValidate: true });
      }
    });
  };

  return (
    <div className="space-y-2">
      {showLabel && <FormLabel>{t("CREATE_OIDC.TOKEN_LIFETIMES")}</FormLabel>}
      <RadioGroup
        aria-label={t("CREATE_OIDC.TOKEN_LIFETIMES")}
        value={mode}
        onValueChange={(value) => handleModeChange(value as TokenLifetimeMode)}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {getTokenModeOptions().map((option) => (
            <div
              key={option.value}
              className={`flex items-start gap-2 rounded-md border p-3 ${
                mode === option.value ? "border-primary bg-primary/5" : "border-input"
              }`}
            >
              <RadioGroupItem value={option.value} id={option.id} className="mt-0.5" />
              <div className="space-y-1">
                <Label htmlFor={option.id} className="cursor-pointer text-sm">
                  {option.label}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {option.value === "project"
                    ? projectSummary(projectConfig)
                    : t("CREATE_OIDC.MODE_CUSTOM_HINT")}
                </p>
              </div>
            </div>
          ))}
        </div>
      </RadioGroup>
      {mode === "custom" && (
        <div className="rounded-md border px-3">
          {lifetimeFields.map((lifetime) => {
            const projectMinutes = knownMinutes(projectConfig?.[lifetime.projectKey]);
            return (
              <FormField
                key={lifetime.name}
                control={form.control}
                name={lifetime.name}
                render={({ field, fieldState }) => (
                  <FormItem className="grid grid-cols-1 gap-x-4 gap-y-2 space-y-0 border-b py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_11rem]">
                    <div className="space-y-1">
                      <FormLabel>{lifetime.label}</FormLabel>
                      <FormDescription className="text-xs">{lifetime.note}</FormDescription>
                    </div>
                    <div className="space-y-1">
                      <div className="relative">
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="numeric"
                            autoComplete="off"
                            min={1}
                            max={lifetime.max}
                            step={1}
                            placeholder={t("CREATE_OIDC.PLACEHOLDER_PROJECT_SETTING")}
                            aria-label={lifetime.ariaLabel}
                            className="pr-11"
                            {...field}
                          />
                        </FormControl>
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
                        >
                          {t("CREATE_OIDC.MINUTES_UNIT")}
                        </span>
                      </div>
                      {!fieldState.error && (
                        <p className="text-xs text-muted-foreground">
                          {describeTokenLifetime(field.value, projectMinutes)}
                        </p>
                      )}
                      <FormMessage className="text-xs" />
                    </div>
                  </FormItem>
                )}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export const ClientNameField = ({ ctl }: FieldProps) => {
  const { t } = useT(I18N_MODULE);
  return (
    <FormField
      control={ctl.form.control}
      name="clientDisplayName"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {t("CREATE_OIDC.CLIENT_NAME")} <span className="text-destructive">*</span>
          </FormLabel>
          <FormControl>
            <Input placeholder={t("CREATE_OIDC.CLIENT_NAME_PLACEHOLDER")} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export const DeviceFlowField = ({ ctl }: FieldProps) => {
  const { t } = useT(I18N_MODULE);
  const { form } = ctl;
  return (
    <FormField
      control={form.control}
      name="isDeviceFlowClient"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t("CREATE_OIDC.DEVICE_FLOW")}</FormLabel>
          <div className="flex items-center gap-2">
            <Checkbox
              id="isDeviceFlowClient"
              className="shrink-0"
              checked={!!field.value}
              onCheckedChange={(v) => {
                field.onChange(!!v);
                if (v) {
                  form.clearErrors("redirectUris");
                  // Auto redirect is meaningless without a browser
                  // redirect, so drop any value held before the toggle.
                  form.setValue("isAutoRedirect", false);
                }
              }}
            />
            <label
              htmlFor="isDeviceFlowClient"
              className="cursor-pointer text-sm text-high-emphasis"
            >
              {t("CREATE_OIDC.DEVICE_FLOW_LABEL")}
            </label>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

/** Hidden for device flow, like Redirect URI(s); the value is kept, so unticking restores it. */
export const ApplicationTypeField = ({ ctl }: FieldProps) => {
  const { t } = useT(I18N_MODULE);
  const applicationTypeOptions = getApplicationTypeOptions();
  const applicationTypeHelper = getApplicationTypeHelper();
  return (
    <FormField
      control={ctl.form.control}
      name="applicationType"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t("CREATE_OIDC.APPLICATION_TYPE")}</FormLabel>
          <FormControl>
            <RadioGroup
              aria-label={t("CREATE_OIDC.APPLICATION_TYPE")}
              value={field.value}
              onValueChange={(value) => ctl.handleApplicationTypeChange(value as ApplicationType)}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {applicationTypeOptions.map((option) => (
                  <div
                    key={option.value}
                    className={`flex items-center gap-2 rounded-md border p-3 ${
                      field.value === option.value ? "border-primary bg-primary/5" : "border-input"
                    }`}
                  >
                    <RadioGroupItem value={option.value} id={option.id} />
                    <Label htmlFor={option.id} className="cursor-pointer text-sm">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </FormControl>
          <FormDescription className="text-xs">
            {applicationTypeHelper[field.value]}
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

/** Redirect URI(s): several entries, like an identity provider. */
export const RedirectUrisField = ({ ctl, showLabel = true }: LabelledFieldProps) => {
  const { t } = useT(I18N_MODULE);
  const { form, redirectUris, applicationType } = ctl;
  const { fields, append, remove } = redirectUris;
  const errors = form.formState.errors.redirectUris;
  return (
    <div className="space-y-2">
      {showLabel && (
        <FormLabel>
          {t("CREATE_OIDC.REDIRECT_URIS")} <span className="text-destructive">*</span>
        </FormLabel>
      )}
      {fields.map((fieldItem, idx) => (
        <div key={fieldItem.id} className="flex items-start gap-2">
          <div className="flex-1 space-y-1">
            <Input
              placeholder={REDIRECT_URI_PLACEHOLDER[applicationType]}
              aria-label={showLabel ? undefined : t("CREATE_OIDC.REDIRECT_URIS")}
              {...form.register(`redirectUris.${idx}.value` as const)}
            />
            <FormMessage>{errors?.[idx]?.value?.message as string}</FormMessage>
          </div>
          {fields.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mt-0 h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => remove(idx)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-1 h-7 gap-1 px-2 text-xs"
        onClick={() => append({ value: "" })}
      >
        <Plus className="h-3 w-3" />
        {t("CREATE_OIDC.ADD_REDIRECT_URI")}
      </Button>
      {errors && !Array.isArray(errors) && (
        <p className="text-xs text-destructive">{errors.message as string}</p>
      )}
    </div>
  );
};

export const StatusField = ({ ctl }: FieldProps) => {
  const { t } = useT(I18N_MODULE);
  return (
    <FormField
      control={ctl.form.control}
      name="isActive"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t("common:STATUS")}</FormLabel>
          <div className="flex items-center gap-2">
            <Checkbox
              id="isActive"
              checked={!!field.value}
              onCheckedChange={(v) => field.onChange(!!v)}
            />
            <label htmlFor="isActive" className="cursor-pointer text-sm text-high-emphasis">
              {t("CREATE_OIDC.ACTIVE")}
            </label>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export const ScopeField = ({ ctl }: FieldProps) => {
  const { t } = useT(I18N_MODULE);
  return (
    <FormField
      control={ctl.form.control}
      name="scope"
      render={() => (
        <FormItem>
          <FormLabel>{t("CREATE_OIDC.SCOPES")}</FormLabel>
          <FormControl>
            <div className="flex items-center gap-2">
              <Checkbox id="scope-openid" checked disabled />
              <label
                htmlFor="scope-openid"
                className="cursor-not-allowed text-sm text-muted-foreground"
                // eslint-disable-next-line no-restricted-syntax -- OIDC scope identifier
              >
                openid
              </label>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

/** Mobile apps always require PKCE. Not offered for device flow. */
export const PkceField = ({ ctl }: FieldProps) => {
  const { t } = useT(I18N_MODULE);
  return (
    <FormField
      control={ctl.form.control}
      name="requirePkce"
      render={({ field }) => (
        <FormItem>
          <FormLabel>PKCE</FormLabel>
          {ctl.isMobile ? (
            <div className="flex items-center gap-2">
              <Checkbox id="requirePkce" checked disabled />
              <label
                htmlFor="requirePkce"
                className="cursor-not-allowed text-sm text-muted-foreground"
              >
                {t("CREATE_OIDC.PKCE_REQUIRED_MOBILE")}
              </label>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Checkbox
                id="requirePkce"
                checked={!!field.value}
                onCheckedChange={(v) => field.onChange(!!v)}
              />
              <label htmlFor="requirePkce" className="cursor-pointer text-sm text-high-emphasis">
                {t("common:ENABLED")}
              </label>
            </div>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

/**
 * Device-flow clients never redirect a browser: the device polls /oidc/token while the user
 * approves elsewhere, so this is not offered for them.
 */
export const AutoRedirectField = ({ ctl }: FieldProps) => {
  const { t } = useT(I18N_MODULE);
  return (
    <FormField
      control={ctl.form.control}
      name="isAutoRedirect"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t("CREATE_OIDC.AUTO_REDIRECT")}</FormLabel>
          <div className="flex items-center gap-2">
            <Checkbox
              id="isAutoRedirect"
              checked={!!field.value}
              onCheckedChange={(v) => field.onChange(!!v)}
            />
            <label htmlFor="isAutoRedirect" className="cursor-pointer text-sm text-high-emphasis">
              {t("CREATE_OIDC.AUTO_REDIRECT_LABEL")}
            </label>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

/**
 * Register as Identity Provider, with the full explanation in the tooltip. Not offered for
 * device-flow clients (federation hardcodes the authorization_code grant and reuses redirect URIs,
 * which they don't have) nor for mobile app clients (blocks-iam SPEC29).
 */
export const IdentityProviderField = ({ ctl, showLabel = true }: LabelledFieldProps) => {
  const { t } = useT(I18N_MODULE);
  return (
    <FormField
      control={ctl.form.control}
      name="registerAsIdentityProvider"
      render={({ field }) => (
        <FormItem>
          {showLabel && <FormLabel>{t("CREATE_OIDC.IDENTITY_PROVIDER")}</FormLabel>}
          <div className="flex items-center gap-2">
            <Checkbox
              id="registerAsIdentityProvider"
              className="shrink-0"
              checked={!!field.value}
              onCheckedChange={(v) => field.onChange(!!v)}
            />
            <label
              htmlFor="registerAsIdentityProvider"
              className="cursor-pointer text-sm text-high-emphasis"
            >
              {t("CREATE_OIDC.IDENTITY_PROVIDER_LABEL")}
            </label>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={t("CREATE_OIDC.IDENTITY_PROVIDER_INFO_LABEL")}
                  className="shrink-0 rounded-full text-muted-foreground transition-colors hover:text-high-emphasis focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs leading-relaxed">{t("CREATE_OIDC.IDENTITY_PROVIDER_INFO")}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
