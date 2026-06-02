import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Plus, X } from "lucide-react";
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
import { Textarea } from "@/components/ui-kits/textarea/textarea";
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
import {
  IdentityProvider,
  IdentityProviderType,
  TokenEndpointAuthMethod,
} from "@blocks-idp/authentication/models/identity-provider.model";
import {
  useCreateIdentityProvider,
  useUpdateIdentityProvider,
} from "@blocks-idp/authentication/hooks/use-identity-provider";

const PROVIDER_TYPES: { value: string; label: string }[] = [
  { value: "oidc", label: "OpenID Connect (OIDC)" },
  { value: "oauth2", label: "OAuth 2.0" },
  { value: "saml", label: "SAML 2.0" },
  { value: "ldap", label: "LDAP" },
  { value: "social", label: "Social" },
  { value: "others", label: "Others" },
];

const TOKEN_AUTH_METHODS: { value: TokenEndpointAuthMethod; label: string }[] = [
  { value: "client_secret_basic", label: "Client Secret Basic" },
  { value: "client_secret_post", label: "Client Secret Post" },
  { value: "none", label: "None (Public Client)" },
];

type FormValues = {
  displayName: string;
  providerType: string;
  provider: string;
  description?: string;
  tokenEndpointAuthMethod: TokenEndpointAuthMethod;
  clientId: string;
  clientSecret: string;
  issuerUrl?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  jwksUri?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editItem?: IdentityProvider;
};

const BLANK_FORM: FormValues = {
  displayName: "",
  providerType: "oidc",
  provider: "",
  description: "",
  tokenEndpointAuthMethod: "client_secret_basic",
  clientId: "",
  clientSecret: "",
  issuerUrl: "",
  authorizationUrl: "",
  tokenUrl: "",
  userInfoUrl: "",
  jwksUri: "",
};

export function IdentityProviderFormDialog({ open, onOpenChange, editItem }: Props) {
  const isEditing = !!editItem?.itemId;

  const [customProviderType, setCustomProviderType] = useState("");
  const [redirectUris, setRedirectUris] = useState<string[]>([""]);

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
  const tokenEndpointAuthMethod = watch("tokenEndpointAuthMethod");
  const isOidc = providerType === "oidc";
  const isOthers = providerType === "others";

  useEffect(() => {
    if (open && editItem) {
      const isCustom = !PROVIDER_TYPES.some(
        (t) => t.value !== "others" && t.value === editItem.providerType,
      );
      reset({
        displayName: editItem.displayName,
        providerType: isCustom ? "others" : editItem.providerType,
        provider: editItem.provider,
        description: editItem.description ?? "",
        tokenEndpointAuthMethod: editItem.tokenEndpointAuthMethod ?? "client_secret_basic",
        clientId: editItem.clientId,
        clientSecret: "",
        issuerUrl: editItem.issuerUrl ?? "",
        authorizationUrl: editItem.authorizationUrl ?? "",
        tokenUrl: editItem.tokenUrl ?? "",
        userInfoUrl: editItem.userInfoUrl ?? "",
        jwksUri: editItem.jwksUri ?? "",
      });
      setCustomProviderType(isCustom ? editItem.providerType : "");
      setRedirectUris(
        editItem.redirectUri?.length ? editItem.redirectUri : [""],
      );
    } else if (open) {
      reset(BLANK_FORM);
      setCustomProviderType("");
      setRedirectUris([""]);
    }
  }, [open, editItem, reset]);

  const { mutateAsync: create, isPending: isCreating } = useCreateIdentityProvider();
  const { mutateAsync: update, isPending: isUpdating } = useUpdateIdentityProvider();
  const isPending = isCreating || isUpdating;

  const onSubmit = async (values: FormValues) => {
    try {
      const finalProviderType: IdentityProviderType =
        isOthers && customProviderType.trim()
          ? customProviderType.trim()
          : values.providerType;

      const payload: IdentityProvider = {
        ...values,
        providerType: finalProviderType,
        scope: "openid",
        redirectUri: redirectUris.filter((u) => u.trim()),
        isActive: editItem?.isActive ?? true,
        ...(isEditing ? { itemId: editItem!.itemId } : {}),
      };

      const res = isEditing
        ? await update({ id: editItem!.itemId!, provider: payload })
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

  const isSubmitDisabled =
    isPending || !isValid || (isOthers && !customProviderType.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Identity Provider" : "Add Identity Provider"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Basic Information
            </h3>

            {/* Display Name */}
            <div className="space-y-1.5">
              <Label htmlFor="displayName">
                Display Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="displayName"
                placeholder="My Identity Provider"
                {...register("displayName", { required: "Display name is required" })}
              />
              {errors.displayName && (
                <p className="text-xs text-destructive">{errors.displayName.message}</p>
              )}
            </div>

            {/* Provider Type */}
            <div className="space-y-1.5">
              <Label htmlFor="providerType">
                Provider Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={providerType}
                onValueChange={(v) => setValue("providerType", v, { shouldValidate: true })}
              >
                <SelectTrigger id="providerType">
                  <SelectValue placeholder="Select provider type" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Provider Type (shown when "Others" selected) */}
            {isOthers && (
              <div className="space-y-1.5">
                <Label htmlFor="customProviderType">
                  Custom Provider Type <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="customProviderType"
                  placeholder="e.g. twitter, github, custom-idp"
                  value={customProviderType}
                  onChange={(e) => setCustomProviderType(e.target.value)}
                />
              </div>
            )}

            {/* Provider Name (Internal Name) */}
            <div className="space-y-1.5">
              <Label htmlFor="provider">
                Provider Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="provider"
                placeholder="my-identity-provider"
                {...register("provider", { required: "Provider name is required" })}
              />
              {errors.provider && (
                <p className="text-xs text-destructive">{errors.provider.message}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional description"
                rows={2}
                {...register("description")}
              />
            </div>

            {/* Token Endpoint Auth Method */}
            <div className="space-y-1.5">
              <Label htmlFor="tokenEndpointAuthMethod">
                Token Endpoint Auth Method <span className="text-destructive">*</span>
              </Label>
              <Select
                value={tokenEndpointAuthMethod}
                onValueChange={(v) =>
                  setValue("tokenEndpointAuthMethod", v as TokenEndpointAuthMethod, {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="tokenEndpointAuthMethod">
                  <SelectValue placeholder="Select auth method" />
                </SelectTrigger>
                <SelectContent>
                  {TOKEN_AUTH_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Credentials */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Credentials
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="clientId">
                  Client ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="clientId"
                  placeholder="Enter client ID"
                  {...register("clientId", { required: "Client ID is required" })}
                />
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
                <Input
                  id="clientSecret"
                  type="password"
                  placeholder={isEditing ? "••••••••••••" : "Enter client secret"}
                  {...register("clientSecret", {
                    required: isEditing ? false : "Client secret is required",
                  })}
                />
                {errors.clientSecret && (
                  <p className="text-xs text-destructive">{errors.clientSecret.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Endpoints */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Endpoints
            </h3>
            {isOidc && (
              <div className="space-y-1.5">
                <Label htmlFor="issuerUrl">Issuer URL</Label>
                <Input
                  id="issuerUrl"
                  placeholder="https://idp.example.com"
                  {...register("issuerUrl")}
                />
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="authorizationUrl">Authorization URL</Label>
                <Input
                  id="authorizationUrl"
                  placeholder="https://idp.example.com/oauth/authorize"
                  {...register("authorizationUrl")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tokenUrl">Token URL</Label>
                <Input
                  id="tokenUrl"
                  placeholder="https://idp.example.com/oauth/token"
                  {...register("tokenUrl")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="userInfoUrl">UserInfo URL</Label>
                <Input
                  id="userInfoUrl"
                  placeholder="https://idp.example.com/oauth/userinfo"
                  {...register("userInfoUrl")}
                />
              </div>
              {isOidc && (
                <div className="space-y-1.5">
                  <Label htmlFor="jwksUri">Well Known URL</Label>
                  <Input
                    id="jwksUri"
                    placeholder="https://idp.example.com/.well-known/jwks.json"
                    {...register("jwksUri")}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Configuration
            </h3>

            {/* Scope — hardcoded, disabled */}
            <div className="space-y-1.5">
              <Label>Scope(s)</Label>
              <div className="flex items-center gap-2">
                <Checkbox checked disabled />
                <span className="text-sm text-muted-foreground">openid</span>
              </div>
            </div>

            {/* Redirect URIs — array */}
            <div className="space-y-2">
              <Label>Redirect URI(s)</Label>
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1 gap-1.5"
                onClick={addRedirectUri}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Redirect URI
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitDisabled}>
              {isPending ? "Saving…" : isEditing ? "Save Changes" : "Add Provider"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
