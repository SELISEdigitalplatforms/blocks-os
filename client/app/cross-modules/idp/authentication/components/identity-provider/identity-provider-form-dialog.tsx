import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { AlertTriangle, Eye, EyeOff, Info, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui-kits/dialog/dialog";
import { Button } from "@/components/ui-kits/button/button";
import { Input } from "@/components/ui-kits/input/input";
import { Label } from "@/components/ui-kits/label/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { IdentityProvider } from "@blocks-idp/authentication/models/identity-provider.model";
import {
  useCreateIdentityProvider,
  useGetIdentityProviderById,
  useGetIdentityProviders,
  useUpdateIdentityProvider,
} from "@blocks-idp/authentication/hooks/use-identity-provider";
import {
  BLOCKS_OIDC_HELP,
  BYOS_HELP,
  SOCIAL_AUTH_PROVIDERS_CONFIG,
  SSO_PROVIDERS,
} from "@blocks-idp/authentication/constants/sso-providers.constant";
import { ENTERPRISE_CARD_INFO, PROVIDER_CONFIG } from "./identity-provider-visual.constant";
import { IRole } from "@blocks-idp/iam/models/role";
import { IPermission } from "@blocks-idp/iam/models/permission";
import { SSOInitialRoles } from "@blocks-idp/authentication/components/sso-initial-roles/sso-initial-roles";
import { SSOInitialPermissions } from "@blocks-idp/authentication/components/sso-initial-permissions/sso-initial-permissions";
import { ScopeMultiSelect } from "./scope-multi-select";
import {
  toPermissionStubs,
  toRoleStubs,
  buildIdentityProviderPayload,
  getSocialLoginRedirectUri,
  hasRedirectUri,
  addRedirectUriToList,
  isDisplayNameTaken,
  isMicrosoftSocial,
  isValidMicrosoftTenant,
  microsoftTenantOf,
  suggestDisplayName,
} from "./identity-provider-form.util";
import { getBlocksIamBaseUrl } from "@blocks-idp/settings/utils/auth-config-form";
import { useProjectStore, useT } from "@seliseblocks/genesis-os";
import { getBlocksOidcWellKnownUrl } from "@/lib/get-api-path";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";

const PROVIDER_SOCIAL = "social";
const PROVIDER_BLOCKS_OIDC = "blocks-oidc";
const PROVIDER_BYOS = "byos";
const PROVIDER_TYPE_VALUES = new Set([PROVIDER_SOCIAL, PROVIDER_BLOCKS_OIDC, PROVIDER_BYOS]);

type FormValues = {
  displayName: string;
  providerType: string;
  provider: string;
  clientId: string;
  clientSecret: string;
  wellKnownUrl?: string;
  audience?: string;
  tenant: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editId?: string;
  /** Preselects "Select Provider" when opening in add mode. Ignored while editing. */
  presetProviderType?: string;
  /** Preselects "Provider Name" (social only) when opening in add mode. Ignored while editing. */
  presetProvider?: string;
};

const BLANK_FORM: FormValues = {
  displayName: "",
  providerType: PROVIDER_SOCIAL,
  provider: "",
  clientId: "",
  clientSecret: "",
  wellKnownUrl: "",
  audience: "",
  tenant: "",
};

const socialLabel = (provider?: string) =>
  SOCIAL_AUTH_PROVIDERS_CONFIG[provider as SSO_PROVIDERS]?.label;

const SOCIAL_PROVIDER_LABELS = new Set(
  Object.values(SOCIAL_AUTH_PROVIDERS_CONFIG).map((config) => config?.label ?? ""),
);

const parseScopes = (scope?: string): string[] => {
  const scopes = (scope ?? "").split(/[\s,]+/).filter(Boolean);
  return scopes.includes("openid") ? scopes : ["openid", ...scopes];
};

const parseRedirectUris = (provider: IdentityProvider): string[] => {
  const uris = Array.isArray(provider.redirectUris)
    ? provider.redirectUris
    : provider.redirectUris
      ? [provider.redirectUris as unknown as string]
      : Array.isArray(provider.redirectUri)
        ? provider.redirectUri
        : provider.redirectUri
          ? [provider.redirectUri as string]
          : [""];
  return uris.length ? uris : [""];
};

const toFormValues = (provider: IdentityProvider): FormValues => {
  const matched = PROVIDER_TYPE_VALUES.has(provider.providerType);
  return {
    displayName: provider.displayName ?? "",
    providerType: matched ? provider.providerType : PROVIDER_SOCIAL,
    provider: provider.provider,
    clientId: provider.clientId,
    clientSecret: "",
    wellKnownUrl: provider.wellKnownUrl ?? "",
    audience: provider.audience ?? "",
    tenant: isMicrosoftSocial(provider.providerType, provider.provider)
      ? microsoftTenantOf(provider.wellKnownUrl)
      : "",
  };
};

const submitLabelKey = (isPending: boolean, isEditing: boolean) => {
  if (isPending) return "IDENTITY_PROVIDER_FORM_DIALOG.SAVING";
  return isEditing
    ? "IDENTITY_PROVIDER_FORM_DIALOG.SAVE_CHANGES"
    : "IDENTITY_PROVIDER_FORM_DIALOG.ADD_PROVIDER";
};

// Shows or hides a masked field's value.
function RevealToggle({ shown, onToggle }: Readonly<{ shown: boolean; onToggle: () => void }>) {
  return (
    <button
      type="button"
      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      onClick={onToggle}
    >
      {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}

// Pre-fill confirmation banner: what was picked from the gallery (social provider or enterprise
// type), with a way back to the gallery.
function PresetBanner({
  presetProvider,
  presetProviderType,
  onChange,
}: Readonly<{ presetProvider?: string; presetProviderType?: string; onChange: () => void }>) {
  const { t } = useT("os.idp.identity-provider");
  const pickedSocialMeta = presetProvider
    ? SOCIAL_AUTH_PROVIDERS_CONFIG[presetProvider as SSO_PROVIDERS]
    : undefined;
  const pickedEnterpriseMeta =
    presetProviderType === PROVIDER_BLOCKS_OIDC || presetProviderType === PROVIDER_BYOS
      ? ENTERPRISE_CARD_INFO[presetProviderType]
      : undefined;
  let icon: ReactNode = null;
  if (pickedSocialMeta) {
    icon = (
      <img
        src={pickedSocialMeta.imageSrc}
        alt={pickedSocialMeta.label}
        className="h-[22px] w-[22px] object-contain"
      />
    );
  } else if (pickedEnterpriseMeta && presetProviderType) {
    const Icon = PROVIDER_CONFIG[presetProviderType]?.Icon;
    icon = Icon ? <Icon className="h-[18px] w-[18px] text-primary" /> : null;
  }
  return (
    <div className="flex items-center gap-3.5 rounded-lg border border-primary/25 bg-primary/4 p-3.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border bg-background">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-primary">
          {pickedSocialMeta?.label ?? pickedEnterpriseMeta?.label}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {pickedSocialMeta?.description ?? pickedEnterpriseMeta?.description}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 shrink-0 border-primary/40 px-3 text-xs font-semibold text-primary hover:bg-primary/5 hover:text-primary"
        onClick={onChange}
      >
        {t("IDENTITY_PROVIDER_FORM_DIALOG.CHANGE")}
      </Button>
    </div>
  );
}

export function IdentityProviderFormDialog({
  open,
  onOpenChange,
  editId,
  presetProviderType,
  presetProvider,
}: Props) {
  const { t } = useT("os.idp.identity-provider");
  const isEditing = !!editId;
  const providerOptions: { value: string; label: string }[] = [
    { value: PROVIDER_SOCIAL, label: t("IDENTITY_PROVIDER_FORM_DIALOG.TYPE_SOCIAL") },
    { value: PROVIDER_BLOCKS_OIDC, label: "Blocks OIDC" },
    { value: PROVIDER_BYOS, label: t("IDENTITY_PROVIDER_FORM_DIALOG.TYPE_BYOS") },
  ];
  const selectedProject = useProjectStore().selectedProject;
  const tenantId = selectedProject?.tenantId || "";
  const { data: providerList } = useGetIdentityProviders({
    projectId: selectedProject?.itemId || "",
  });
  // Several Google or Microsoft entries are told apart by display name.
  const existingProviders = useMemo(() => providerList?.data ?? [], [providerList]);

  const {
    data: providerResponse,
    isLoading: isLoadingProvider,
    isError: isProviderFetchError,
    error: providerFetchError,
  } = useGetIdentityProviderById(editId ?? "", open && isEditing);

  const editedProvider = providerResponse?.isSuccess ? providerResponse.data : undefined;

  // Tracks whether the form has actually been populated (via `reset()`) for the
  // current open/edit target - not just whether the network request finished.
  // Gating the skeleton on `isLoadingProvider` alone leaves a render in between
  // (data arrived, but `reset()` hasn't run yet) where the form mounts with its
  // still-blank defaults, which is what made "Provider Name" flash empty.
  const [isFormReady, setIsFormReady] = useState(false);
  const isFormLoading = isEditing && !isFormReady;

  const [redirectUris, setRedirectUris] = useState<string[]>([""]);
  const [showClientId, setShowClientId] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<IRole[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<IPermission[]>([]);
  const [scopes, setScopes] = useState<string[]>(["openid"]);
  const [requirePkce, setRequirePkce] = useState(false);
  const [redirectUrisError, setRedirectUrisError] = useState<string | null>(null);
  // Whether "Change" has been clicked on the pre-fill banner for the current open dialog
  // session - reset every time the dialog freshly opens in add mode (see the effect below).
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    trigger,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    mode: "onChange",
    defaultValues: BLANK_FORM,
  });

  const providerType = watch("providerType");
  const providerName = watch("provider");
  const isSocialType = providerType === PROVIDER_SOCIAL;
  const showTenant = isMicrosoftSocial(providerType, providerName);
  const blocksOidcWellKnownUrl = tenantId ? getBlocksOidcWellKnownUrl(tenantId) : "";
  const selectedSocialProvider = SOCIAL_AUTH_PROVIDERS_CONFIG[watch("provider") as SSO_PROVIDERS];
  const loginRedirectUri = getSocialLoginRedirectUri(
    getBlocksIamBaseUrl(),
    providerType,
    watch("provider"),
    tenantId,
  );
  const loginRedirectUriListed = hasRedirectUri(redirectUris, loginRedirectUri);

  // Google and Microsoft can each hold several entries (one per app registration), so
  // both stay selectable no matter what is already configured.
  const socialProviderOptions = Object.values(SOCIAL_AUTH_PROVIDERS_CONFIG).filter(
    (c) => c.provider === "google" || c.provider === "microsoft",
  );

  useEffect(() => {
    if (providerType === PROVIDER_BLOCKS_OIDC && blocksOidcWellKnownUrl) {
      setValue("wellKnownUrl", blocksOidcWellKnownUrl, { shouldValidate: true });
    }
  }, [providerType, blocksOidcWellKnownUrl, setValue]);

  useEffect(() => {
    if (!open) {
      setIsFormReady(false);
      return;
    }

    if (!isEditing) {
      reset({
        ...BLANK_FORM,
        providerType: presetProviderType ?? BLANK_FORM.providerType,
        provider: presetProvider ?? BLANK_FORM.provider,
      });
      setRedirectUris([""]);
      setSelectedRoles([]);
      setSelectedPermissions([]);
      setScopes(["openid"]);
      setRequirePkce(false);
      setRedirectUrisError(null);
      setBannerDismissed(false);
      setIsFormReady(true);
      return;
    }

    if (isLoadingProvider) {
      setIsFormReady(false);
      return;
    }

    if (!providerResponse?.isSuccess || !editedProvider) {
      showErrorToast({
        errors: providerResponse?.errors ?? {
          not_found: t("IDENTITY_PROVIDER_FORM_DIALOG.PROVIDER_NOT_FOUND"),
        },
      });
      onOpenChange(false);
      return;
    }

    reset(toFormValues(editedProvider));
    setRedirectUris(parseRedirectUris(editedProvider));
    setSelectedRoles(toRoleStubs(editedProvider.initialRoles ?? []));
    setSelectedPermissions(toPermissionStubs(editedProvider.initialPermissions ?? []));
    setScopes(parseScopes(editedProvider.scope));
    setRequirePkce(!!editedProvider.requirePkce);
    setRedirectUrisError(null);
    setIsFormReady(true);
  }, [
    open,
    isEditing,
    isLoadingProvider,
    providerResponse,
    editedProvider,
    reset,
    onOpenChange,
    presetProviderType,
    presetProvider,
    t,
  ]);

  useEffect(() => {
    if (!open || !isEditing || !isProviderFetchError) return;
    if (isErrorWithErrors(providerFetchError)) {
      showErrorToast({ errors: providerFetchError.errors });
    } else {
      showErrorToast({
        errors: { not_found: t("IDENTITY_PROVIDER_FORM_DIALOG.PROVIDER_NOT_FOUND") },
      });
    }
    onOpenChange(false);
  }, [open, isEditing, isProviderFetchError, providerFetchError, onOpenChange, t]);

  // A new Google or Microsoft entry starts named after its provider, unless another entry of it
  // already has that name. Only a name filled in this way is replaced when the provider changes.
  useEffect(() => {
    if (!open || isEditing || !isFormReady || !isSocialType) return;
    const current = (getValues("displayName") ?? "").trim();
    if (current && !SOCIAL_PROVIDER_LABELS.has(current)) return;
    const suggestion = suggestDisplayName(
      existingProviders,
      providerName,
      socialLabel(providerName),
    );
    if (suggestion !== current) setValue("displayName", suggestion, { shouldValidate: true });
  }, [
    open,
    isEditing,
    isFormReady,
    isSocialType,
    providerName,
    existingProviders,
    getValues,
    setValue,
  ]);

  // The list can arrive after the name was typed: check the name against it again.
  useEffect(() => {
    if (open && isFormReady && (getValues("displayName") ?? "").trim()) void trigger("displayName");
  }, [open, isFormReady, existingProviders, getValues, trigger]);

  const validateDisplayName = (value: string) => {
    const name = (value ?? "").trim();
    if (!name) {
      return isSocialType ? t("IDENTITY_PROVIDER_FORM_DIALOG.DISPLAY_NAME_REQUIRED") : true;
    }
    return isDisplayNameTaken(existingProviders, providerName, name, editId)
      ? t("IDENTITY_PROVIDER_FORM_DIALOG.DISPLAY_NAME_TAKEN", {
          provider: socialLabel(providerName) ?? providerName,
        })
      : true;
  };

  // The pre-fill banner reflects what was picked from the gallery (the original preset
  // props), not the live form value - it stays put even if the admin starts tweaking the
  // dropdowns, and only "Change" (below) clears it.
  const hasPreset = !isEditing && (!!presetProviderType || !!presetProvider);
  const showBanner = hasPreset && !bannerDismissed;
  const clientIdInputType = showClientId ? "text" : "password";
  const clientSecretInputType = showClientSecret ? "text" : "password";
  const clientSecretPlaceholder = isEditing
    ? "••••••••••••"
    : t("IDENTITY_PROVIDER_FORM_DIALOG.CLIENT_SECRET_PLACEHOLDER");
  const clientSecretRequired = isEditing
    ? false
    : t("IDENTITY_PROVIDER_FORM_DIALOG.CLIENT_SECRET_REQUIRED");

  // The help box, by contrast, tracks the live selection - it shows for a manual pick too
  // (H3), not just a gallery pre-fill, and disappears again in edit mode. Defensive per C6:
  // never render a box with a missing/empty title or body.
  const helpContent = ((): { title: string; body: string } | undefined => {
    if (isEditing) return undefined;
    if (providerType === PROVIDER_SOCIAL) {
      const meta = SOCIAL_AUTH_PROVIDERS_CONFIG[watch("provider") as SSO_PROVIDERS];
      return meta?.helpTitle && meta?.helpBody
        ? { title: meta.helpTitle, body: meta.helpBody }
        : undefined;
    }
    let staticHelp: typeof BLOCKS_OIDC_HELP | typeof BYOS_HELP | undefined;
    if (providerType === PROVIDER_BLOCKS_OIDC) staticHelp = BLOCKS_OIDC_HELP;
    else if (providerType === PROVIDER_BYOS) staticHelp = BYOS_HELP;
    return staticHelp?.title && staticHelp?.body ? staticHelp : undefined;
  })();

  const handleChangeProvider = () => {
    reset({
      ...BLANK_FORM,
      provider: "",
    });
    setBannerDismissed(true);
  };

  const { mutateAsync: create, isPending: isCreating } = useCreateIdentityProvider();
  const { mutateAsync: update, isPending: isUpdating } = useUpdateIdentityProvider();
  const isPending = isCreating || isUpdating;
  const submitLabel = t(submitLabelKey(isPending, isEditing));

  const onSubmit = async (values: FormValues) => {
    const cleanedUris = redirectUris.map((u) => u.trim()).filter(Boolean);
    if (cleanedUris.length === 0) {
      setRedirectUrisError(t("IDENTITY_PROVIDER_FORM_DIALOG.REDIRECT_URI_REQUIRED"));
      return;
    }
    setRedirectUrisError(null);
    try {
      const payload = buildIdentityProviderPayload({
        values,
        cleanedUris,
        selectedRoles,
        selectedPermissions,
        scopes,
        requirePkce,
        blocksOidcWellKnownUrl,
        editedProvider,
        editId,
        isEditing,
      });

      const res = isEditing
        ? await update({ id: editId!, provider: payload })
        : await create(payload);

      if (!res.isSuccess) return showErrorToast({ errors: res.errors });

      showSuccessToast({
        description: isEditing
          ? t("IDENTITY_PROVIDER_FORM_DIALOG.UPDATED_SUCCESS")
          : t("IDENTITY_PROVIDER_FORM_DIALOG.CREATED_SUCCESS"),
      });
      onOpenChange(false);
    } catch (err) {
      if (isErrorWithErrors(err)) return showErrorToast({ errors: err.errors });
      showErrorToast({ errors: t("IDENTITY_PROVIDER_FORM_DIALOG.ERROR_GENERIC") });
    }
  };

  const addRedirectUri = () => setRedirectUris((prev) => [...prev, ""]);
  const addLoginRedirectUri = () =>
    setRedirectUris((prev) => addRedirectUriToList(prev, loginRedirectUri));
  const removeRedirectUri = (idx: number) =>
    setRedirectUris((prev) => prev.filter((_, i) => i !== idx));
  const updateRedirectUri = (idx: number, val: string) =>
    setRedirectUris((prev) => prev.map((u, i) => (i === idx ? val : u)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-[640px] flex-col gap-0 overflow-hidden p-0">
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
          <DialogHeader>
            <DialogTitle>
              {isEditing
                ? t("IDENTITY_PROVIDER_FORM_DIALOG.EDIT_TITLE")
                : t("IDENTITY_PROVIDER_FORM_DIALOG.ADD_TITLE")}
            </DialogTitle>
          </DialogHeader>

          {isFormLoading ? (
            <div
              className="space-y-4"
              aria-busy="true"
              aria-label={t("IDENTITY_PROVIDER_FORM_DIALOG.LOADING_PROVIDER")}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Pre-fill confirmation banner - add mode + picked from the gallery only */}
              {showBanner && (
                <PresetBanner
                  presetProvider={presetProvider}
                  presetProviderType={presetProviderType}
                  onChange={handleChangeProvider}
                />
              )}

              {/* Select Provider */}
              <div className="space-y-1.5">
                <Label htmlFor="providerType">
                  {t("IDENTITY_PROVIDER_FORM_DIALOG.SELECT_PROVIDER")}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={providerType}
                  disabled={isEditing}
                  onValueChange={(v) => setValue("providerType", v, { shouldValidate: true })}
                >
                  <SelectTrigger id="providerType">
                    <SelectValue placeholder={t("IDENTITY_PROVIDER_FORM_DIALOG.SELECT_PROVIDER")} />
                  </SelectTrigger>
                  <SelectContent>
                    {providerOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Provider Name */}
              <div className="space-y-1.5">
                <Label htmlFor="provider">
                  {t("IDENTITY_PROVIDER_FORM_DIALOG.PROVIDER_NAME")}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                {providerType === PROVIDER_SOCIAL ? (
                  <Select
                    value={watch("provider")}
                    onValueChange={(v) => setValue("provider", v, { shouldValidate: true })}
                  >
                    <SelectTrigger id="provider">
                      {/* Radix only knows an item's label once SelectContent has mounted at
                          least once, which never happens for a value set programmatically
                          (e.g. via `reset()` when editing) before the user opens it - so the
                          trigger renders blank the first time. Passing the label in ourselves
                          sidesteps that. */}
                      <SelectValue
                        placeholder={t("IDENTITY_PROVIDER_FORM_DIALOG.SELECT_A_PROVIDER")}
                      >
                        {selectedSocialProvider && (
                          <div className="flex items-center gap-3">
                            <img
                              src={selectedSocialProvider.imageSrc}
                              alt={selectedSocialProvider.label}
                              className="h-5 w-5 object-contain"
                            />
                            <span>{selectedSocialProvider.label}</span>
                          </div>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {socialProviderOptions.map((config) => (
                        <SelectItem key={config.provider} value={config.provider}>
                          <div className="flex items-center gap-3">
                            <img
                              src={config.imageSrc}
                              alt={config.label}
                              className="h-5 w-5 object-contain"
                            />
                            <span>{config.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="provider"
                    placeholder={t("IDENTITY_PROVIDER_FORM_DIALOG.PROVIDER_PLACEHOLDER")}
                    disabled={isEditing}
                    {...register("provider", {
                      required: t("IDENTITY_PROVIDER_FORM_DIALOG.PROVIDER_REQUIRED"),
                    })}
                  />
                )}
                {errors.provider && (
                  <p className="text-xs text-destructive">{errors.provider.message}</p>
                )}
              </div>

              {/* Display name: what tells several Google or Microsoft entries apart */}
              <div className="space-y-1.5">
                <Label htmlFor="displayName">
                  {t("IDENTITY_PROVIDER_FORM_DIALOG.DISPLAY_NAME")}
                  {isSocialType && (
                    <>
                      {" "}
                      <span className="text-destructive">*</span>
                    </>
                  )}
                </Label>
                <Input
                  id="displayName"
                  placeholder={t("IDENTITY_PROVIDER_FORM_DIALOG.DISPLAY_NAME_PLACEHOLDER")}
                  {...register("displayName", { validate: validateDisplayName })}
                />
                <p className="text-xs text-muted-foreground">
                  {t("IDENTITY_PROVIDER_FORM_DIALOG.DISPLAY_NAME_HINT")}
                </p>
                {errors.displayName && (
                  <p className="text-xs text-destructive">{errors.displayName.message}</p>
                )}
              </div>

              {/* Microsoft Entra tenant: sent as that tenant's discovery URL */}
              {showTenant && (
                <div className="space-y-1.5">
                  <Label htmlFor="tenant">
                    {t("IDENTITY_PROVIDER_FORM_DIALOG.MICROSOFT_TENANT")}
                  </Label>
                  <Input
                    id="tenant"
                    placeholder={t("IDENTITY_PROVIDER_FORM_DIALOG.MICROSOFT_TENANT_PLACEHOLDER")}
                    {...register("tenant", {
                      validate: (value) =>
                        isValidMicrosoftTenant(value ?? "") ||
                        t("IDENTITY_PROVIDER_FORM_DIALOG.MICROSOFT_TENANT_INVALID"),
                    })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("IDENTITY_PROVIDER_FORM_DIALOG.MICROSOFT_TENANT_HINT")}
                  </p>
                  {errors.tenant && (
                    <p className="text-xs text-destructive">{errors.tenant.message}</p>
                  )}
                </div>
              )}

              {/* Client ID + Client Secret */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="clientId">
                    {t("IDENTITY_PROVIDER_FORM_DIALOG.CLIENT_ID")}{" "}
                    <span className="text-destructive">*</span>
                    {isEditing && (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        {t("IDENTITY_PROVIDER_FORM_DIALOG.CLIENT_ID_LOCKED")}
                      </span>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      id="clientId"
                      type={clientIdInputType}
                      placeholder={t("IDENTITY_PROVIDER_FORM_DIALOG.CLIENT_ID_PLACEHOLDER")}
                      className="pr-10"
                      disabled={isEditing}
                      {...register("clientId", {
                        required: t("IDENTITY_PROVIDER_FORM_DIALOG.CLIENT_ID_REQUIRED"),
                      })}
                    />
                    <RevealToggle
                      shown={showClientId}
                      onToggle={() => setShowClientId(!showClientId)}
                    />
                  </div>
                  {errors.clientId && (
                    <p className="text-xs text-destructive">{errors.clientId.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="clientSecret">
                    {t("IDENTITY_PROVIDER_FORM_DIALOG.CLIENT_SECRET")}{" "}
                    <span className="text-destructive">*</span>
                    {isEditing && (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        {t("IDENTITY_PROVIDER_FORM_DIALOG.CLIENT_SECRET_HIDDEN")}
                      </span>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      id="clientSecret"
                      type={clientSecretInputType}
                      placeholder={clientSecretPlaceholder}
                      className="pr-10"
                      {...register("clientSecret", {
                        required: clientSecretRequired,
                      })}
                    />
                    <RevealToggle
                      shown={showClientSecret}
                      onToggle={() => setShowClientSecret(!showClientSecret)}
                    />
                  </div>
                  {errors.clientSecret && (
                    <p className="text-xs text-destructive">{errors.clientSecret.message}</p>
                  )}
                </div>
              </div>

              {/* Audience */}
              {/* <div className="space-y-1.5">
            <Label htmlFor="audience">Audience</Label>
            <Input
              id="audience"
              placeholder="Enter audience"
              {...register("audience")}
            />
          </div> */}

              {/* Contextual help - shown for the currently selected provider, add mode only */}
              {helpContent && (
                <div className="flex gap-3 rounded-lg border border-dashed bg-muted/40 p-3.5">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-high-emphasis">{helpContent.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {helpContent.body}
                    </p>
                  </div>
                </div>
              )}

              {/* Well Known URL (auto-generated) - shown only for Blocks OIDC */}
              {providerType === PROVIDER_BLOCKS_OIDC && (
                <div className="space-y-1.5">
                  <Label htmlFor="generatedWellKnownUrl">
                    {t("IDENTITY_PROVIDER_FORM_DIALOG.WELL_KNOWN_URL")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="generatedWellKnownUrl"
                      readOnly
                      aria-readonly="true"
                      tabIndex={-1}
                      value={blocksOidcWellKnownUrl}
                      className="cursor-default bg-muted font-mono text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <CopyToClipboardButton textToCopy={blocksOidcWellKnownUrl}>
                      <span />
                    </CopyToClipboardButton>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("IDENTITY_PROVIDER_FORM_DIALOG.WELL_KNOWN_HINT")}
                  </p>
                </div>
              )}

              {/* Well Known URL - Hidden for social type */}
              {/* {providerType !== "social" && (
            <div className="space-y-1.5">
              <Label htmlFor="wellKnownUrl">
                Well Known URL <span className="text-destructive">*</span>
              </Label>
              <Input
                id="wellKnownUrl"
                placeholder="https://idp.example.com/.well-known/openid-configuration"
                {...register("wellKnownUrl", {
                  required: "Well Known URL is required",
                  validate: (v) =>
                    !v || /^https?:\/\/.+/.test(v) || "Enter a valid URL",
                })}
              />
              {errors.wellKnownUrl && (
                <p className="text-xs text-destructive">{errors.wellKnownUrl.message}</p>
              )}
            </div>
          )} */}

              {/* Redirect URIs */}
              <div className="space-y-2">
                <Label>
                  {t("IDENTITY_PROVIDER_FORM_DIALOG.REDIRECT_URIS")}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                {loginRedirectUri && (
                  <div
                    className="space-y-1.5 rounded-lg border bg-muted/40 p-3"
                    data-testid="login-redirect-uri"
                  >
                    <p className="text-xs font-semibold text-high-emphasis">
                      {t("IDENTITY_PROVIDER_FORM_DIALOG.LOGIN_REDIRECT_TITLE")}
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        aria-label={t("IDENTITY_PROVIDER_FORM_DIALOG.LOGIN_REDIRECT_TITLE")}
                        readOnly
                        aria-readonly="true"
                        tabIndex={-1}
                        value={loginRedirectUri}
                        className="cursor-default bg-muted font-mono text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                      <CopyToClipboardButton textToCopy={loginRedirectUri}>
                        <span />
                      </CopyToClipboardButton>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {t("IDENTITY_PROVIDER_FORM_DIALOG.LOGIN_REDIRECT_HINT")}
                    </p>
                    {!loginRedirectUriListed && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning-200 bg-warning-50 px-2.5 py-1.5">
                        <p className="flex items-center gap-1.5 text-xs text-warning-800">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          {t("IDENTITY_PROVIDER_FORM_DIALOG.NOT_IN_LIST")}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={addLoginRedirectUri}
                        >
                          {t("IDENTITY_PROVIDER_FORM_DIALOG.ADD_TO_LIST")}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                {redirectUris.map((uri, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={uri}
                      onChange={(e) => updateRedirectUri(idx, e.target.value)}
                      placeholder={t("IDENTITY_PROVIDER_FORM_DIALOG.REDIRECT_PLACEHOLDER")}
                    />
                    {redirectUris.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeRedirectUri(idx)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {redirectUrisError && (
                  <p className="text-xs text-destructive">{redirectUrisError}</p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1 h-7 gap-1 px-2 text-xs"
                  onClick={addRedirectUri}
                >
                  <Plus className="h-3 w-3" />
                  {t("IDENTITY_PROVIDER_FORM_DIALOG.ADD_REDIRECT_URI")}
                </Button>
              </div>

              {/* Initial Roles */}
              <SSOInitialRoles roles={selectedRoles} onChange={setSelectedRoles} />

              {/* Initial Permissions */}
              <SSOInitialPermissions
                permissions={selectedPermissions}
                onChange={setSelectedPermissions}
              />

              {/* Scope(s) + PKCE */}
              <div className="space-y-1.5">
                <Label>{t("IDENTITY_PROVIDER_FORM_DIALOG.SCOPES")}</Label>
                <ScopeMultiSelect value={scopes} onChange={setScopes} />
                {/* <div className="flex items-center gap-2">
              <Checkbox
                id="requirePkce"
                checked={requirePkce}
                onCheckedChange={(v) => setRequirePkce(!!v)}
              />
              <Label htmlFor="requirePkce" className="cursor-pointer">
                Require PKCE
              </Label>
            </div> */}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {t("common:CANCEL")}
                </Button>
                <Button type="submit" disabled={isPending || !isValid || isFormLoading}>
                  {submitLabel}
                </Button>
              </DialogFooter>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
