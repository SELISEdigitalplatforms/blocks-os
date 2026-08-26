import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Eye, EyeOff, Plus, X } from "lucide-react";
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
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
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
  useUpdateIdentityProvider,
} from "@blocks-idp/authentication/hooks/use-identity-provider";
import {
  SOCIAL_AUTH_PROVIDERS_CONFIG,
  SSO_PROVIDERS,
} from "@blocks-idp/authentication/constants/sso-providers.constant";
import { IRole } from "@blocks-idp/iam/models/role";
import { IPermission } from "@blocks-idp/iam/models/permission";
import { SSOInitialRoles } from "@blocks-idp/authentication/components/sso-initial-roles/sso-initial-roles";
import { SSOInitialPermissions } from "@blocks-idp/authentication/components/sso-initial-permissions/sso-initial-permissions";
import {
  toPermissionStubs,
  toRoleStubs,
  buildIdentityProviderPayload,
} from "./identity-provider-form.util";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { getBlocksOidcWellKnownUrl } from "@/lib/get-api-path";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";

const PROVIDER_OPTIONS: { value: string; label: string }[] = [
  { value: "social", label: "Social" },
  { value: "blocks-oidc", label: "Blocks OIDC" },
  { value: "byos", label: "Bring your own SSO (BYOS)" },
  // { value: "google", label: "Google" },
  // { value: "microsoft", label: "Microsoft" },
  // { value: "linkedin", label: "LinkedIn" },
  // { value: "github", label: "GitHub" },
];

type FormValues = {
  displayName: string;
  providerType: string;
  provider: string;
  clientId: string;
  clientSecret: string;
  wellKnownUrl?: string;
  audience?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editId?: string;
};

const BLANK_FORM: FormValues = {
  displayName: "",
  providerType: "social",
  provider: "",
  clientId: "",
  clientSecret: "",
  wellKnownUrl: "",
  audience: "",
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
  const matched = PROVIDER_OPTIONS.some((t) => t.value === provider.providerType);
  return {
    displayName: provider.displayName,
    providerType: matched ? provider.providerType : "social",
    provider: provider.provider,
    clientId: provider.clientId,
    clientSecret: "",
    wellKnownUrl: provider.wellKnownUrl ?? "",
    audience: provider.audience ?? "",
  };
};

export function IdentityProviderFormDialog({ open, onOpenChange, editId }: Props) {
  const isEditing = !!editId;
  const tenantId = useProjectStore().selectedProject?.tenantId || "";

  const {
    data: providerResponse,
    isLoading: isLoadingProvider,
    isError: isProviderFetchError,
    error: providerFetchError,
  } = useGetIdentityProviderById(editId ?? "", open && isEditing);

  const editedProvider = providerResponse?.isSuccess ? providerResponse.data : undefined;
  const isFormLoading = isEditing && isLoadingProvider;

  const [redirectUris, setRedirectUris] = useState<string[]>([""]);
  const [showClientId, setShowClientId] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<IRole[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<IPermission[]>([]);
  const [requirePkce, setRequirePkce] = useState(false);
  const [redirectUrisError, setRedirectUrisError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    mode: "onChange",
    defaultValues: BLANK_FORM,
  });

  const providerType = watch("providerType");
  const blocksOidcWellKnownUrl = tenantId ? getBlocksOidcWellKnownUrl(tenantId) : "";
  const selectedSocialProvider = SOCIAL_AUTH_PROVIDERS_CONFIG[watch("provider") as SSO_PROVIDERS];

  useEffect(() => {
    if (providerType === "blocks-oidc" && blocksOidcWellKnownUrl) {
      setValue("wellKnownUrl", blocksOidcWellKnownUrl, { shouldValidate: true });
    }
  }, [providerType, blocksOidcWellKnownUrl, setValue]);

  useEffect(() => {
    if (!open) return;

    if (!isEditing) {
      reset(BLANK_FORM);
      setRedirectUris([""]);
      setSelectedRoles([]);
      setSelectedPermissions([]);
      setRequirePkce(false);
      setRedirectUrisError(null);
      return;
    }

    if (isLoadingProvider) return;

    if (!providerResponse?.isSuccess || !editedProvider) {
      showErrorToast({
        errors: providerResponse?.errors ?? { not_found: "Provider not found." },
      });
      onOpenChange(false);
      return;
    }

    reset(toFormValues(editedProvider));
    setRedirectUris(parseRedirectUris(editedProvider));
    setSelectedRoles(toRoleStubs(editedProvider.initialRoles ?? []));
    setSelectedPermissions(toPermissionStubs(editedProvider.initialPermissions ?? []));
    setRequirePkce(!!editedProvider.requirePkce);
    setRedirectUrisError(null);
  }, [open, isEditing, isLoadingProvider, providerResponse, editedProvider, reset, onOpenChange]);

  useEffect(() => {
    if (!open || !isEditing || !isProviderFetchError) return;
    if (isErrorWithErrors(providerFetchError)) {
      showErrorToast({ errors: providerFetchError.errors });
    } else {
      showErrorToast({ errors: { not_found: "Provider not found." } });
    }
    onOpenChange(false);
  }, [open, isEditing, isProviderFetchError, providerFetchError, onOpenChange]);

  const { mutateAsync: create, isPending: isCreating } = useCreateIdentityProvider();
  const { mutateAsync: update, isPending: isUpdating } = useUpdateIdentityProvider();
  const isPending = isCreating || isUpdating;

  const onSubmit = async (values: FormValues) => {
    const cleanedUris = redirectUris.map((u) => u.trim()).filter(Boolean);
    if (cleanedUris.length === 0) {
      setRedirectUrisError("At least one redirect URI is required");
      return;
    }
    setRedirectUrisError(null);
    try {
      const payload = buildIdentityProviderPayload({
        values,
        cleanedUris,
        selectedRoles,
        selectedPermissions,
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
          ? "Identity provider updated successfully"
          : "Identity provider created successfully",
      });
      onOpenChange(false);
    } catch (err) {
      if (isErrorWithErrors(err)) return showErrorToast({ errors: err.errors });
      showErrorToast({ errors: "Something went wrong" });
    }
  };

  const addRedirectUri = () => setRedirectUris((prev) => [...prev, ""]);
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
              {isEditing ? "Edit Identity Provider" : "Add Identity Provider"}
            </DialogTitle>
          </DialogHeader>

          {isFormLoading ? (
            <div className="space-y-4" aria-busy="true" aria-label="Loading provider">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Select Provider */}
              <div className="space-y-1.5">
                <Label htmlFor="providerType">
                  Select Provider <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={providerType}
                  disabled={isEditing}
                  onValueChange={(v) => setValue("providerType", v, { shouldValidate: true })}
                >
                  <SelectTrigger id="providerType">
                    <SelectValue placeholder="Select Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Provider Name */}
              <div className="space-y-1.5">
                <Label htmlFor="provider">
                  Provider Name <span className="text-destructive">*</span>
                </Label>
                {providerType === "social" ? (
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
                      <SelectValue placeholder="Select a provider">
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
                      {Object.values(SOCIAL_AUTH_PROVIDERS_CONFIG)
                        .filter((c) => c.provider === "google" || c.provider === "microsoft")
                        .map((config) => (
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
                    placeholder="my-identity-provider"
                    disabled={isEditing}
                    {...register("provider", { required: "Provider name is required" })}
                  />
                )}
                {errors.provider && (
                  <p className="text-xs text-destructive">{errors.provider.message}</p>
                )}
              </div>

              {/* Client ID + Client Secret */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="clientId">
                    Client ID <span className="text-destructive">*</span>
                    {isEditing && (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        (Cannot be changed)
                      </span>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      id="clientId"
                      type={showClientId ? "text" : "password"}
                      placeholder="Enter client ID"
                      className="pr-10"
                      disabled={isEditing}
                      {...register("clientId", { required: "Client ID is required" })}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowClientId(!showClientId)}
                    >
                      {showClientId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.clientId && (
                    <p className="text-xs text-destructive">{errors.clientId.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="clientSecret">
                    Client Secret <span className="text-destructive">*</span>
                    {isEditing && (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        (leave blank to keep existing)
                      </span>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      id="clientSecret"
                      type={showClientSecret ? "text" : "password"}
                      placeholder={isEditing ? "••••••••••••" : "Enter client secret"}
                      className="pr-10"
                      {...register("clientSecret", {
                        required: isEditing ? false : "Client secret is required",
                      })}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowClientSecret(!showClientSecret)}
                    >
                      {showClientSecret ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
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

              {/* Well Known URL (auto-generated) - shown only for Blocks OIDC */}
              {providerType === "blocks-oidc" && (
                <div className="space-y-1.5">
                  <Label htmlFor="generatedWellKnownUrl">Well Known URL</Label>
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
                    Auto-generated discovery URL for this Blocks OIDC provider.
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
                  Redirect URI(s) <span className="text-destructive">*</span>
                </Label>
                {redirectUris.map((uri, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={uri}
                      onChange={(e) => updateRedirectUri(idx, e.target.value)}
                      placeholder="https://your-app.com/callback"
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
                  Add Redirect URI
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
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Label>Scope(s)</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox checked disabled />
                    <span className="text-sm text-muted-foreground">openid</span>
                  </div>
                </div>
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
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending || !isValid || isFormLoading}>
                  {isPending ? "Saving…" : isEditing ? "Save Changes" : "Add Provider"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
