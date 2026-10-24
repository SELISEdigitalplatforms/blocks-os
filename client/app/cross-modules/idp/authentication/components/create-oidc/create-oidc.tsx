import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useFieldArray, useForm, type UseFormReturn } from "react-hook-form";
import { Info, Plus, Pencil, X } from "lucide-react";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { ISaveOidcCredentialPayload } from "@blocks-idp/authentication/models/auth.oidc.model";
import {
  useGetAuthOidcCredential,
  useSaveAuthOidc,
} from "@blocks-idp/authentication/hooks/use-auth-oidc";
import { useGetAuthConfig } from "@blocks-idp/authentication/hooks/use-auth-config";
import { normalizeAuthConfigResponse } from "@blocks-idp/settings/utils/normalize-auth-config";
import type { ISettingsAuthConfig } from "@blocks-idp/settings/models/settings.model";
import {
  ApplicationType,
  buildTokenLifetimesPayload,
  createOIDCFormDefaultValue,
  CreateOIDCFormValues,
  createOidcSchema,
  deriveApplicationType,
  describeTokenLifetime,
  formatMinutes,
  getRedirectUriSchema,
  knownMinutes,
  TOKEN_LIFETIME_LIMITS,
  type TokenLifetimeFormValues,
  tokenLifetimesToForm,
} from "./utils";
import { Input } from "@/components/ui-kits/input/input";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { Label } from "@/components/ui-kits/label/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui-kits/radio-group/radio-group";
import { Button } from "@/components/ui-kits/button/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui-kits/tooltip/tooltip";
import { isErrorWithErrors } from "@/lib/error";
import { OneTimeSecret, OneTimeSecretDialog } from "../one-time-secret-dialog";

const APPLICATION_TYPE_OPTIONS: { value: ApplicationType; id: string; label: string }[] = [
  { value: "web", id: "applicationType-web", label: "Web application" },
  { value: "mobile", id: "applicationType-mobile", label: "Mobile app" },
];

const APPLICATION_TYPE_HELPER: Record<ApplicationType, string> = {
  web: "For browser-based apps.",
  mobile:
    "For iOS and Android apps. Uses a public client with PKCE, and the app receives tokens in the token response.",
};

const REDIRECT_URI_PLACEHOLDER: Record<ApplicationType, string> = {
  web: "https://example.com/oidc",
  mobile: "com.example.app://callback",
};

type ProjectLifetimeKey =
  | "accessTokenValidForNumberMinutes"
  | "refreshTokenValidForNumberMinutes"
  | "absoluteRefreshTokenValidForNumberMinutes";

const TOKEN_LIFETIME_FIELDS: {
  name: keyof TokenLifetimeFormValues;
  label: string;
  shortLabel: string;
  note: string;
  ariaLabel: string;
  max: number;
  projectKey: ProjectLifetimeKey;
}[] = [
  {
    name: "accessTokenLifetime",
    label: "Access token",
    shortLabel: "Access",
    note: "How long a sign-in stays valid before the app must refresh it. Shorter is safer.",
    ariaLabel: "Access token lifetime in minutes",
    max: TOKEN_LIFETIME_LIMITS.access.max,
    projectKey: "accessTokenValidForNumberMinutes",
  },
  {
    name: "refreshTokenLifetime",
    label: "Refresh token – idle",
    shortLabel: "Idle",
    note: "Signs the user out after this long without using the app.",
    ariaLabel: "Refresh token idle lifetime in minutes",
    max: TOKEN_LIFETIME_LIMITS.refresh.max,
    projectKey: "refreshTokenValidForNumberMinutes",
  },
  {
    name: "absoluteRefreshTokenLifetime",
    label: "Refresh token – maximum",
    shortLabel: "Maximum",
    note: "Signs the user out after this time, even when active. At least the idle time.",
    ariaLabel: "Refresh token maximum lifetime in minutes",
    max: TOKEN_LIFETIME_LIMITS.refresh.max,
    projectKey: "absoluteRefreshTokenValidForNumberMinutes",
  },
];

type TokenLifetimeMode = "project" | "custom";

const TOKEN_MODE_OPTIONS: { value: TokenLifetimeMode; id: string; label: string }[] = [
  { value: "project", id: "tokenLifetimes-project", label: "Use project settings" },
  { value: "custom", id: "tokenLifetimes-custom", label: "Custom for this client" },
];

const hasAnyLifetime = (values: TokenLifetimeFormValues) =>
  Object.values(values).some((value) => value.trim() !== "");

const modeForLifetimes = (values: TokenLifetimeFormValues): TokenLifetimeMode =>
  hasAnyLifetime(values) ? "custom" : "project";

const toProjectConfig = (raw: Parameters<typeof normalizeAuthConfigResponse>[0] | undefined) =>
  raw ? normalizeAuthConfigResponse(raw) : undefined;

const projectSummary = (config?: ISettingsAuthConfig) => {
  if (!config) return "The values set for the whole project.";
  const parts = TOKEN_LIFETIME_FIELDS.map((lifetime) => {
    const minutes = knownMinutes(config[lifetime.projectKey]);
    return minutes === undefined ? undefined : `${lifetime.shortLabel} ${formatMinutes(minutes)}`;
  }).filter(Boolean);
  return parts.length ? parts.join(" · ") : "The values set for the whole project.";
};

type TokenLifetimesSectionProps = {
  form: UseFormReturn<CreateOIDCFormValues>;
  mode: TokenLifetimeMode;
  onModeChange: (mode: TokenLifetimeMode) => void;
  projectConfig?: ISettingsAuthConfig;
};

/** Per-client token lifetimes: the project values, or this client's own values. */
const TokenLifetimesSection = ({
  form,
  mode,
  onModeChange,
  projectConfig,
}: Readonly<TokenLifetimesSectionProps>) => {
  const handleModeChange = (next: TokenLifetimeMode) => {
    onModeChange(next);
    TOKEN_LIFETIME_FIELDS.forEach((lifetime) => {
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
      <FormLabel>Token lifetimes</FormLabel>
      <RadioGroup
        aria-label="Token lifetimes"
        value={mode}
        onValueChange={(value) => handleModeChange(value as TokenLifetimeMode)}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TOKEN_MODE_OPTIONS.map((option) => (
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
                    : "Set different values for this client only."}
                </p>
              </div>
            </div>
          ))}
        </div>
      </RadioGroup>
      {mode === "custom" && (
        <div className="rounded-md border px-3">
          {TOKEN_LIFETIME_FIELDS.map((lifetime) => {
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
                            placeholder="Project setting"
                            aria-label={lifetime.ariaLabel}
                            className="pr-11"
                            {...field}
                          />
                        </FormControl>
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
                        >
                          min
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

type CreateOIDCProps = {
  itemId?: string;
  triggerVariant?: "default" | "ghost" | "outline";
};

export const CreateOIDC = ({ itemId, triggerVariant = "default" }: CreateOIDCProps) => {
  const [open, setOpen] = useState<boolean>(false);
  const [createdSecret, setCreatedSecret] = useState<OneTimeSecret | null>(null);
  const [tokenMode, setTokenMode] = useState<TokenLifetimeMode>("project");
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { mutateAsync, isPending } = useSaveAuthOidc();
  // Guards against a second POST while a save is still in flight (C12).
  const submittingRef = useRef(false);
  const { data: existingOidc, isLoading: _isLoadingOidc } = useGetAuthOidcCredential(
    { projectKey: tenantId, clientId: itemId! },
    open && !!itemId,
  );
  const { data: authConfig } = useGetAuthConfig({ projectKey: tenantId }, open);
  const projectConfig = toProjectConfig(authConfig);

  const form = useForm<CreateOIDCFormValues>({
    resolver: zodResolver(createOidcSchema),
    mode: "onChange",
    defaultValues: createOIDCFormDefaultValue,
  });

  const {
    formState: { isValid, isSubmitting },
    control,
    register,
  } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "redirectUris",
  });

  const isEditMode = !!itemId;
  const dialogTitle = isEditMode ? "Edit OIDC Client" : "New OIDC Client";
  const dialogDescription = isEditMode
    ? "Update OIDC client details"
    : "Enter details to generate a new key";
  const isDeviceFlowClient = form.watch("isDeviceFlowClient");
  const applicationType = form.watch("applicationType");
  const isMobile = applicationType === "mobile";

  const handleApplicationTypeChange = (next: ApplicationType) => {
    form.setValue("applicationType", next, { shouldDirty: true, shouldValidate: true });
    if (next === "mobile") {
      form.setValue("requirePkce", true, { shouldDirty: true });
      form.setValue("registerAsIdentityProvider", false, { shouldDirty: true });
    }
    // Re-check the entries already typed so a type switch flags (or clears) them at once.
    const filled = form
      .getValues("redirectUris")
      .map((entry, idx) => (entry.value.trim() ? idx : -1))
      .filter((idx) => idx >= 0)
      .map((idx) => `redirectUris.${idx}.value` as const);
    if (filled.length) void form.trigger(filled);
  };

  useEffect(() => {
    if (isEditMode && existingOidc?.oIDCClientCredential && open) {
      const credential = existingOidc.oIDCClientCredential;
      const loadedApplicationType = deriveApplicationType(credential);
      const loadedTokenLifetimes = tokenLifetimesToForm(existingOidc.tokenLifetimes);
      const uris =
        credential.redirectUris && credential.redirectUris.length
          ? credential.redirectUris
          : credential.redirectUri
            ? [credential.redirectUri]
            : [""];
      form.reset({
        redirectUris: uris.map((u) => ({ value: u })),
        scope: credential.scope || "openid",
        clientDisplayName: credential.clientDisplayName || "",
        isAutoRedirect: credential.isDeviceFlowClient
          ? false
          : (credential.isAutoRedirect ?? false),
        isActive: credential.isActive ?? true,
        requirePkce: credential.requirePkce ?? true,
        registerAsIdentityProvider: credential.registerAsIdentityProvider ?? false,
        isDeviceFlowClient: credential.isDeviceFlowClient ?? false,
        allowedResponseTypes: credential.isDeviceFlowClient
          ? []
          : credential.allowedResponseTypes && credential.allowedResponseTypes.length
            ? credential.allowedResponseTypes
            : ["code"],
        applicationType: loadedApplicationType,
        storedClientType: credential.clientType ?? null,
        storedUseTokensCookie: credential.useTokensCookie ?? true,
        loadedApplicationType,
        ...loadedTokenLifetimes,
        loadedTokenLifetimes,
      });
      const loadedMode = modeForLifetimes(loadedTokenLifetimes);
      setTokenMode(loadedMode);
      // A stored value the rules reject is flagged at once, not only after the user edits it.
      if (loadedMode === "custom") {
        void form.trigger([
          "accessTokenLifetime",
          "refreshTokenLifetime",
          "absoluteRefreshTokenLifetime",
        ]);
      }
    } else if (!isEditMode && open) {
      form.reset(createOIDCFormDefaultValue);
      setTokenMode("project");
    }
  }, [existingOidc, isEditMode, open, form]);

  const buildClientTypeFields = (
    data: CreateOIDCFormValues,
  ): Pick<
    ISaveOidcCredentialPayload,
    "clientType" | "useTokensCookie" | "requirePkce" | "registerAsIdentityProvider"
  > => {
    // Spec 6.4 payload mapping.
    if (data.isDeviceFlowClient) {
      return {
        ...(isEditMode ? { clientType: data.storedClientType } : {}),
        useTokensCookie: data.storedUseTokensCookie,
        requirePkce: false,
        registerAsIdentityProvider: false,
      };
    }
    if (data.applicationType === "mobile") {
      return {
        clientType: "public",
        useTokensCookie: false,
        requirePkce: true,
        registerAsIdentityProvider: false,
      };
    }
    const keepStored = isEditMode && data.loadedApplicationType === "web";
    return {
      clientType: keepStored ? data.storedClientType : "confidential",
      useTokensCookie: keepStored ? data.storedUseTokensCookie : true,
      requirePkce: data.requirePkce,
      registerAsIdentityProvider: data.registerAsIdentityProvider,
    };
  };

  const onSubmit = async (data: CreateOIDCFormValues) => {
    if (submittingRef.current) return;
    const isDeviceFlowClient = data.isDeviceFlowClient;
    const redirectResult = isDeviceFlowClient
      ? ({ success: true } as const)
      : getRedirectUriSchema(data.applicationType).safeParse(data.redirectUris);
    if (!redirectResult.success) {
      redirectResult.error.issues.forEach((issue) => {
        const path = issue.path as (string | number)[];
        form.setError(
          `redirectUris.${path[0]}.value` as keyof CreateOIDCFormValues,
          { type: "validate", message: issue.message },
          { shouldFocus: true },
        );
      });
      return;
    }
    submittingRef.current = true;
    try {
      // Sent only when a lifetime input changed; otherwise the server keeps the stored values.
      const tokenLifetimes = buildTokenLifetimesPayload(data, data.loadedTokenLifetimes);
      const payload: ISaveOidcCredentialPayload = {
        redirectUris: isDeviceFlowClient
          ? []
          : data.redirectUris.map((entry) => entry.value.trim()).filter(Boolean),
        scope: data.scope,
        isAutoRedirect: isDeviceFlowClient ? false : data.isAutoRedirect,
        isActive: data.isActive,
        ...buildClientTypeFields(data),
        isDeviceFlowClient,
        allowedResponseTypes: isDeviceFlowClient ? [] : data.allowedResponseTypes,
        itemId: isEditMode ? itemId : "",
        clientDisplayName: data.clientDisplayName,
        ...(tokenLifetimes ? { tokenLifetimes } : {}),
      };
      const res = await mutateAsync(payload);
      if (!res.isSuccess) {
        showErrorToast({ errors: res.error });
        return;
      }
      const message = isEditMode
        ? "OIDC Client updated successfully"
        : "OIDC Client created successfully";
      showSuccessToast({ description: message });
      // Create is the only time the API returns the secret; list and get never do.
      if (!isEditMode && res.clientSecret) {
        setCreatedSecret({
          label: data.clientDisplayName || res.itemId || "",
          clientId: res.itemId ?? "",
          clientSecret: res.clientSecret,
          reason: "created",
        });
      }
      form.reset();
      setOpen(false);
    } catch (error) {
      if (isErrorWithErrors(error)) {
        showErrorToast({ errors: error.errors });
        return;
      }
      showErrorToast({ errors: "Something went wrong" });
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Its own dialog: it stays open after this form closes. */}
      <OneTimeSecretDialog secret={createdSecret} onClose={() => setCreatedSecret(null)} />
      {isEditMode ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                variant={triggerVariant}
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-high-emphasis"
                aria-label="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Edit</TooltipContent>
        </Tooltip>
      ) : (
        <DialogTrigger asChild>
          <Button>
            <Plus className="aspect-square w-4" />
            <span className="sr-only sm:not-sr-only sm:ml-2">Create</span>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="flex h-screen max-h-[95vh] w-screen flex-col rounded-none sm:h-auto sm:max-h-[95vh] sm:w-auto sm:rounded-lg md:h-auto md:w-[640px]">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          <Form {...form}>
            <form id="oidc-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 px-1">
              <FormField
                control={form.control}
                name="clientDisplayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Client Name <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Enter client name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isDeviceFlowClient"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Device Flow</FormLabel>
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
                        Generate this OIDC client only for device flow
                      </label>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Application type — hidden for device flow, like Redirect URI(s). The value is
                  kept while hidden, so unticking Device Flow restores the earlier choice. */}
              {!isDeviceFlowClient && (
                <FormField
                  control={form.control}
                  name="applicationType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Application type</FormLabel>
                      <FormControl>
                        <RadioGroup
                          aria-label="Application type"
                          value={field.value}
                          onValueChange={(value) =>
                            handleApplicationTypeChange(value as ApplicationType)
                          }
                        >
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {APPLICATION_TYPE_OPTIONS.map((option) => (
                              <div
                                key={option.value}
                                className={`flex items-center gap-2 rounded-md border p-3 ${
                                  field.value === option.value
                                    ? "border-primary bg-primary/5"
                                    : "border-input"
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
                        {APPLICATION_TYPE_HELPER[field.value]}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Redirect URI(s) - multi entry like identity provider */}
              {!isDeviceFlowClient && (
                <div className="space-y-2">
                  <FormLabel>
                    Redirect URI(s) <span className="text-destructive">*</span>
                  </FormLabel>
                  {fields.map((fieldItem, idx) => (
                    <div key={fieldItem.id} className="flex items-start gap-2">
                      <div className="flex-1 space-y-1">
                        <Input
                          placeholder={REDIRECT_URI_PLACEHOLDER[applicationType]}
                          {...register(`redirectUris.${idx}.value` as const)}
                        />
                        <FormMessage>
                          {form.formState.errors.redirectUris?.[idx]?.value?.message as string}
                        </FormMessage>
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
                    Add Redirect URI
                  </Button>
                  {form.formState.errors.redirectUris &&
                    !Array.isArray(form.formState.errors.redirectUris) && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.redirectUris.message as string}
                      </p>
                    )}
                </div>
              )}

              {/* Status | Scope(s) | PKCE — single borderless row */}
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="isActive"
                          checked={!!field.value}
                          onCheckedChange={(v) => field.onChange(!!v)}
                        />
                        <label
                          htmlFor="isActive"
                          className="cursor-pointer text-sm text-high-emphasis"
                        >
                          Active
                        </label>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="scope"
                  render={() => (
                    <FormItem>
                      <FormLabel>Scope(s)</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Checkbox id="scope-openid" checked disabled />
                          <label
                            htmlFor="scope-openid"
                            className="cursor-not-allowed text-sm text-muted-foreground"
                          >
                            openid
                          </label>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!isDeviceFlowClient && (
                  <FormField
                    control={form.control}
                    name="requirePkce"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PKCE</FormLabel>
                        {isMobile ? (
                          <div className="flex items-center gap-2">
                            <Checkbox id="requirePkce" checked disabled />
                            <label
                              htmlFor="requirePkce"
                              className="cursor-not-allowed text-sm text-muted-foreground"
                            >
                              Required for mobile apps
                            </label>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="requirePkce"
                              checked={!!field.value}
                              onCheckedChange={(v) => field.onChange(!!v)}
                            />
                            <label
                              htmlFor="requirePkce"
                              className="cursor-pointer text-sm text-high-emphasis"
                            >
                              Enabled
                            </label>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Auto Redirect — single borderless row. Device-flow clients never
                  redirect a browser: the device polls /oidc/token while the user
                  approves elsewhere, so the option doesn't apply. */}
              {!isDeviceFlowClient && (
                <FormField
                  control={form.control}
                  name="isAutoRedirect"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Auto Redirect</FormLabel>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="isAutoRedirect"
                          checked={!!field.value}
                          onCheckedChange={(v) => field.onChange(!!v)}
                        />
                        <label
                          htmlFor="isAutoRedirect"
                          className="cursor-pointer text-sm text-high-emphasis"
                        >
                          Redirect automatically after authentication
                        </label>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Register as Identity Provider — on by default; the full
                  explanation lives in the tooltip to keep the row compact.
                  Not offered for device-flow clients: federation hardcodes the
                  authorization_code grant and reuses redirect URIs, which
                  device-flow clients don't have. Mobile app clients are never registered as
                  an identity provider either (blocks-iam SPEC29). */}
              {!isDeviceFlowClient && !isMobile && (
                <FormField
                  control={form.control}
                  name="registerAsIdentityProvider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Identity Provider</FormLabel>
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
                          Register as a Blocks OIDC identity provider
                        </label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label="More about Blocks OIDC identity providers"
                              className="shrink-0 rounded-full text-muted-foreground transition-colors hover:text-high-emphasis focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                              <Info className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-xs leading-relaxed">
                              Adds a matching <span className="font-medium">Blocks OIDC</span> entry
                              under Identity Provider, so other Blocks projects can offer this
                              project as a sign-in option and federate their users to it. Uncheck if
                              this client is only used by your own app to sign users in — you can
                              always add the provider later.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Token lifetimes — the project values, or this client's own values. An input
                  left empty in Custom still uses the project setting. */}
              <TokenLifetimesSection
                form={form}
                mode={tokenMode}
                onModeChange={setTokenMode}
                projectConfig={projectConfig}
              />
            </form>
          </Form>
        </div>
        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            form="oidc-form"
            type="submit"
            disabled={!isValid || isPending || isSubmitting}
            className="w-full sm:w-auto"
          >
            {isEditMode ? "Update" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
