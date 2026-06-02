import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { IdentityProvider, IdentityProviderType, TokenEndpointAuthMethod } from "@blocks-idp/authentication/models/identity-provider.model";
import {
  useCreateIdentityProvider,
  useUpdateIdentityProvider,
} from "@blocks-idp/authentication/hooks/use-identity-provider";

const PROVIDER_TYPES: { value: IdentityProviderType; label: string }[] = [
  { value: "oidc", label: "OpenID Connect (OIDC)" },
  { value: "oauth2", label: "OAuth 2.0" },
  { value: "saml", label: "SAML 2.0" },
  { value: "ldap", label: "LDAP" },
];

const TOKEN_AUTH_METHODS: { value: TokenEndpointAuthMethod; label: string }[] = [
  { value: "client_secret_basic", label: "Client Secret Basic" },
  { value: "client_secret_post", label: "Client Secret Post" },
  { value: "none", label: "None (Public Client)" },
];

type FormValues = Omit<IdentityProvider, "itemId" | "isActive" | "createdDate" | "updatedDate">;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editItem?: IdentityProvider;
};

export function IdentityProviderFormDialog({ open, onOpenChange, editItem }: Props) {
  const isEditing = !!editItem?.itemId;
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    mode: "onChange",
    defaultValues: {
      provider: "",
      displayName: "",
      description: "",
      providerType: "oidc",
      tokenEndpointAuthMethod: "client_secret_basic",
      clientId: "",
      clientSecret: "",
      issuerUrl: "",
      authorizationUrl: "",
      tokenUrl: "",
      userInfoUrl: "",
      jwksUri: "",
      scope: "openid profile email",
      redirectUri: "",
    },
  });

  const providerType = watch("providerType");
  const tokenEndpointAuthMethod = watch("tokenEndpointAuthMethod");

  useEffect(() => {
    if (open && editItem) {
      reset({
        provider: editItem.provider,
        displayName: editItem.displayName,
        description: editItem.description ?? "",
        providerType: editItem.providerType,
        tokenEndpointAuthMethod: editItem.tokenEndpointAuthMethod ?? "client_secret_basic",
        clientId: editItem.clientId,
        clientSecret: "",
        issuerUrl: editItem.issuerUrl ?? "",
        authorizationUrl: editItem.authorizationUrl ?? "",
        tokenUrl: editItem.tokenUrl ?? "",
        userInfoUrl: editItem.userInfoUrl ?? "",
        jwksUri: editItem.jwksUri ?? "",
        scope: editItem.scope ?? "openid profile email",
        redirectUri: editItem.redirectUri ?? "",
      });
    } else if (open) {
      reset({
        provider: "",
        displayName: "",
        description: "",
        providerType: "oidc",
        tokenEndpointAuthMethod: "client_secret_basic",
        clientId: "",
        clientSecret: "",
        issuerUrl: "",
        authorizationUrl: "",
        tokenUrl: "",
        userInfoUrl: "",
        jwksUri: "",
        scope: "openid profile email",
        redirectUri: "",
      });
    }
  }, [open, editItem, reset]);

  const { mutateAsync: create, isPending: isCreating } = useCreateIdentityProvider();
  const { mutateAsync: update, isPending: isUpdating } = useUpdateIdentityProvider();
  const isPending = isCreating || isUpdating;

  const onSubmit = async (values: FormValues) => {
    try {
      const payload: IdentityProvider = {
        ...values,
        isActive: editItem?.isActive ?? true,
        ...(isEditing ? { itemId: editItem!.itemId } : {}),
      };

      const res = isEditing
        ? await update({ id: editItem!.itemId!, provider: payload })
        : await create(payload);

      if (!res.isSuccess) {
        return showErrorToast({ errors: res.errors });
      }
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

  const isOidc = providerType === "oidc";

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
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Internal Name <span className="text-destructive">*</span></Label>
                <Input
                  id="name"
                  placeholder="my-identity-provider"
                  {...register("provider", { required: "Name is required" })}
                />
                {errors.provider && (
                  <p className="text-xs text-destructive">{errors.provider.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="displayName">Display Name <span className="text-destructive">*</span></Label>
                <Input
                  id="displayName"
                  placeholder="My Identity Provider"
                  {...register("displayName", { required: "Display name is required" })}
                />
                {errors.displayName && (
                  <p className="text-xs text-destructive">{errors.displayName.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional description"
                rows={2}
                {...register("description")}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="providerType">Provider Type <span className="text-destructive">*</span></Label>
                <Select
                  value={providerType}
                  onValueChange={(v) => setValue("providerType", v as IdentityProviderType)}
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
              <div className="space-y-1.5">
                <Label htmlFor="tokenEndpointAuthMethod">Token Endpoint Auth Method <span className="text-destructive">*</span></Label>
                <Select
                  value={tokenEndpointAuthMethod}
                  onValueChange={(v) => setValue("tokenEndpointAuthMethod", v as TokenEndpointAuthMethod)}
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
          </div>

          {/* Credentials */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Credentials
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="clientId">Client ID <span className="text-destructive">*</span></Label>
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
                  Client Secret {isEditing && "(leave blank to keep existing)"}
                </Label>
                <Input
                  id="clientSecret"
                  type="password"
                  placeholder={isEditing ? "••••••••••••" : "Enter client secret"}
                  {...register("clientSecret")}
                />
              </div>
            </div>
          </div>

          {/* Endpoints */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
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
                  <Label htmlFor="jwksUri">JWKS URI</Label>
                  <Input
                    id="jwksUri"
                    placeholder="https://idp.example.com/.well-known/jwks.json"
                    {...register("jwksUri")}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Scopes & Redirect */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Configuration
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="scope">Scopes</Label>
                <Input
                  id="scope"
                  placeholder="openid profile email"
                  {...register("scope")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="redirectUri">Redirect URI</Label>
                <Input
                  id="redirectUri"
                  placeholder="https://your-app.com/callback"
                  {...register("redirectUri")}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : isEditing ? "Save Changes" : "Add Provider"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
