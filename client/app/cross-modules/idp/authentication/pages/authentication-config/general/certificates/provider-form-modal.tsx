import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { Input } from "@/components/ui-kits/input/input";
import { Label } from "@/components/ui-kits/label/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { Switch } from "@/components/ui-kits/switch/switch";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { providers } from "@blocks-idp/authentication/constants/authentication.constant";
import { useSaveThirdPartyJwtProvider } from "@blocks-idp/authentication/hooks/use-third-party-jwt-provider";
import {
  isSymmetric,
  JwtSigningAlgorithm,
  SIGNING_ALGORITHMS,
  type ThirdPartyJwtProvider,
} from "@/cross-modules/identifier/models/third-party-jwt-provider.model";

const schema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "Key is required — it is what the x-blocks-idp header names")
    .regex(/^[A-Za-z0-9._-]+$/, "Use letters, digits, dot, dash or underscore only"),
  providerName: z.string().trim().min(1, "Pick a provider"),
  isActive: z.boolean(),
  issuer: z.string().trim().min(1, "Issuer is required — it is how a token reaches this provider"),
  audiences: z.string().trim(),
  algorithm: z.coerce.number(),
  jwksUrl: z.string().trim(),
  signingSecret: z.string(),
  claimUserId: z.string().trim().min(1, "Required — without it every token maps to one principal"),
  claimEmail: z.string().trim(),
  claimUserName: z.string().trim(),
  claimName: z.string().trim(),
  claimRoles: z.string().trim(),
});

type FormData = z.infer<typeof schema>;

const splitAudiences = (value: string) =>
  value
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

type ProviderFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: ThirdPartyJwtProvider | null;
  /** Issuers already in use by other active providers, for the shared-issuer warning. */
  siblingIssuers?: string[];
};

export function ProviderFormModal({
  open,
  onOpenChange,
  existing,
  siblingIssuers = [],
}: Readonly<ProviderFormModalProps>) {
  const { mutateAsync, isPending } = useSaveThirdPartyJwtProvider();

  // `values` rather than defaultValues plus a reset effect: react-hook-form re-syncs when this
  // object changes, which keeps the form in step with the selected provider without a setState
  // inside an effect.
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    values: {
      key: existing?.key ?? "",
      providerName: existing?.providerName ?? "",
      isActive: existing?.isActive ?? true,
      issuer: existing?.issuer ?? "",
      audiences: existing?.audiences?.join(", ") ?? "",
      algorithm: existing?.algorithms?.[0] ?? JwtSigningAlgorithm.RS256,
      jwksUrl: existing?.jwksUrl ?? "",
      signingSecret: "",
      claimUserId: existing?.claimsMapping?.userId ?? "sub",
      claimEmail: existing?.claimsMapping?.email ?? "email",
      claimUserName: existing?.claimsMapping?.userName ?? "email",
      claimName: existing?.claimsMapping?.name ?? "name",
      claimRoles: existing?.claimsMapping?.roles ?? "",
    },
  });

  const { register, handleSubmit, watch, setValue, formState } = form;
  const algorithm = Number(watch("algorithm")) as JwtSigningAlgorithm;
  const symmetric = isSymmetric(algorithm);
  const issuer = watch("issuer")?.trim();
  const audiences = watch("audiences")?.trim();


  // Two providers sharing an issuer AND an audience validate identically, so only the caller's
  // header could tell them apart — which hands the choice of claim mapping to the caller.
  const sharesIssuer = !!issuer && siblingIssuers.includes(issuer);
  const needsAudiences = sharesIssuer && !audiences;

  const onSubmit = async (data: FormData) => {
    const result = await mutateAsync({
      itemId: existing?.itemId,
      key: data.key,
      providerName: data.providerName,
      isActive: data.isActive,
      issuer: data.issuer,
      audiences: splitAudiences(data.audiences),
      algorithms: [Number(data.algorithm) as JwtSigningAlgorithm],
      jwksUrl: symmetric ? undefined : data.jwksUrl,
      signingSecret: symmetric ? data.signingSecret : undefined,
      claimsMapping: {
        userId: data.claimUserId,
        email: data.claimEmail,
        userName: data.claimUserName,
        name: data.claimName,
        roles: data.claimRoles,
      },
    });

    if (!result.isSuccess) {
      showErrorToast({ errors: Object.values(result.errors ?? {}).join(" ") || "Could not save" });
      return;
    }

    showSuccessToast({ description: existing ? "Provider updated" : "Provider added" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit provider" : "Add provider"}</DialogTitle>
          <DialogDescription>
            Tokens signed by this provider will be accepted on your APIs.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="provider-name">Provider</Label>
              <Select
                value={watch("providerName")}
                onValueChange={(value) => setValue("providerName", value, { shouldValidate: true })}
              >
                <SelectTrigger id="provider-name">
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.name}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formState.errors.providerName && (
                <p className="text-xs text-destructive">{formState.errors.providerName.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="provider-key">Key</Label>
              <Input id="provider-key" placeholder="auth0-web" {...register("key")} />
              <p className="text-xs text-muted-foreground">
                The value callers send as <code className="font-mono">x-blocks-idp</code>, if they
                ever need to.
              </p>
              {formState.errors.key && (
                <p className="text-xs text-destructive">{formState.errors.key.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="provider-issuer">Issuer</Label>
            <Input
              id="provider-issuer"
              placeholder="https://your-tenant.us.auth0.com/"
              {...register("issuer")}
            />
            <p className="text-xs text-muted-foreground">
              Matched exactly against the token&apos;s <code className="font-mono">iss</code>,
              trailing slash included.
            </p>
            {formState.errors.issuer && (
              <p className="text-xs text-destructive">{formState.errors.issuer.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="provider-audiences">Audiences</Label>
            <Input
              id="provider-audiences"
              placeholder="https://your-api, another-api"
              {...register("audiences")}
            />
            <p className="text-xs text-muted-foreground">
              Comma separated. Leaving this empty turns audience validation off, so any token from
              this issuer is accepted.
            </p>
            {needsAudiences && (
              <p className="text-xs text-destructive">
                Another active provider already uses this issuer. Give them different audiences, or
                neither can be told apart from the other and the caller chooses which mapping
                applies.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="provider-algorithm">Signing algorithm</Label>
              <Select
                value={String(algorithm)}
                onValueChange={(value) => setValue("algorithm", Number(value))}
              >
                <SelectTrigger id="provider-algorithm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIGNING_ALGORITHMS.map((a) => (
                    <SelectItem key={a.value} value={String(a.value)}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2 pb-1">
              <Switch
                id="provider-active"
                checked={watch("isActive")}
                onCheckedChange={(checked) => setValue("isActive", checked)}
              />
              <Label htmlFor="provider-active">Active</Label>
            </div>
          </div>

          {symmetric ? (
            <div className="space-y-1.5">
              <Label htmlFor="provider-secret">Signing secret</Label>
              <Input
                id="provider-secret"
                type="password"
                autoComplete="new-password"
                placeholder={existing?.hasSigningSecret ? "••••••••  (leave blank to keep)" : ""}
                {...register("signingSecret")}
              />
              <p className="text-xs text-muted-foreground">
                {existing?.hasSigningSecret
                  ? "A secret is stored. Leave this blank to keep it, or type a new one to replace it."
                  : "The shared secret your provider signs with. Stored encrypted and never shown again."}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="provider-jwks">JWKS URL</Label>
              <Input
                id="provider-jwks"
                placeholder="https://your-tenant.us.auth0.com/.well-known/jwks.json"
                {...register("jwksUrl")}
              />
              <p className="text-xs text-muted-foreground">
                Public keys, fetched over HTTPS. No secret is stored for this algorithm.
              </p>
            </div>
          )}

          <div className="space-y-3 rounded-md border p-4">
            <div>
              <h4 className="text-sm font-semibold">Claim mapping</h4>
              <p className="text-xs text-muted-foreground">
                Which claim supplies each field. Names are matched literally, so a namespaced claim
                such as <code className="font-mono">https://app.example.com/roles</code> works as
                written.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="claim-user-id">User ID</Label>
                <Input id="claim-user-id" {...register("claimUserId")} />
                {formState.errors.claimUserId && (
                  <p className="text-xs text-destructive">{formState.errors.claimUserId.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="claim-email">Email</Label>
                <Input id="claim-email" {...register("claimEmail")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="claim-user-name">Username</Label>
                <Input id="claim-user-name" {...register("claimUserName")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="claim-name">Display name</Label>
                <Input id="claim-name" {...register("claimName")} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="claim-roles">Roles</Label>
                <Input id="claim-roles" {...register("claimRoles")} />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {existing ? "Save changes" : "Add provider"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
