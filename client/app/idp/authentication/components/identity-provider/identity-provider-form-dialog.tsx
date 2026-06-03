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

type FormValues = {
  displayName: string;
  providerType: string;
  provider: string;
  clientId: string;
  clientSecret: string;
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
  clientId: "",
  clientSecret: "",
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
        clientId: editItem.clientId,
        clientSecret: "",
        jwksUri: editItem.jwksUri ?? "",
      });
      setCustomProviderType(isCustom ? editItem.providerType : "");
      setRedirectUris(editItem.redirectUri?.length ? editItem.redirectUri : [""]);
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
        tokenEndpointAuthMethod: "client_secret_basic",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Identity Provider" : "Add Identity Provider"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

          {/* Custom Provider Type */}
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

          {/* Provider Name */}
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

          {/* Client ID + Client Secret */}
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

          {/* Well Known URL */}
          <div className="space-y-1.5">
            <Label htmlFor="jwksUri">Well Known URL</Label>
            <Input
              id="jwksUri"
              placeholder="https://idp.example.com/.well-known/jwks.json"
              {...register("jwksUri")}
            />
          </div>

          {/* Scope(s) */}
          <div className="space-y-1.5">
            <Label>Scope(s)</Label>
            <div className="flex items-center gap-2">
              <Checkbox checked disabled />
              <span className="text-sm text-muted-foreground">openid</span>
            </div>
          </div>

          {/* Redirect URIs */}
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !isValid || (isOthers && !customProviderType.trim())}
            >
              {isPending ? "Saving…" : isEditing ? "Save Changes" : "Add Provider"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
