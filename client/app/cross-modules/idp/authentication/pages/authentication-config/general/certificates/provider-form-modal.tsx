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
  type ClaimsMapping,
  type ThirdPartyJwtProvider,
} from "@/cross-modules/identifier/models/third-party-jwt-provider.model";

const KEY_CHARACTERS = /^[A-Za-z0-9._-]+$/;
const KEY_CHARACTERS_MESSAGE = "Use letters, digits, dot, dash or underscore only";

/**
 * The key field follows the same contract as the signing secret: on an edit it starts blank and
 * blank means untouched, because the stored key is only ever shown masked and there is nothing
 * useful to pre-fill it with.
 */
const buildSchema = (isEditing: boolean) =>
  z.object({
    key: isEditing
      ? z
          .string()
          .trim()
          .refine((value) => value === "" || KEY_CHARACTERS.test(value), KEY_CHARACTERS_MESSAGE)
      : z
          .string()
          .trim()
          .min(1, "Key is required — it is what the x-blocks-idp header names")
          .regex(KEY_CHARACTERS, KEY_CHARACTERS_MESSAGE),
    providerName: z.string().trim().min(1, "Pick a provider"),
    isActive: z.boolean(),
    issuer: z.string().trim().min(1, "Issuer is required — it is how a token reaches this provider"),
    audiences: z.string().trim(),
    algorithm: z.coerce.number(),
    jwksUrl: z.string().trim(),
    signingSecret: z.string(),
  });

type FormData = z.infer<ReturnType<typeof buildSchema>>;

/** Marks the fields a provider cannot be saved without, so the rest read as genuinely optional. */
const Required = () => (
  <span className="ml-0.5 text-destructive" aria-hidden="true">
    *
  </span>
);

/** The registered OIDC claim names, which is what a provider emits unless it was told otherwise. */
const DEFAULT_CLAIMS_MAPPING: ClaimsMapping = {
  userId: "sub",
  email: "email",
  userName: "email",
  name: "name",
  roles: "",
};

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
    resolver: zodResolver(buildSchema(!!existing)),
    values: {
      // Blank on an edit, like the signing secret: the stored key is masked, so pre-filling it
      // would only offer the mask back.
      key: "",
      providerName: existing?.providerName ?? "",
      isActive: existing?.isActive ?? true,
      issuer: existing?.issuer ?? "",
      audiences: existing?.audiences?.join(", ") ?? "",
      algorithm: existing?.algorithms?.[0] ?? JwtSigningAlgorithm.RS256,
      jwksUrl: existing?.jwksUrl ?? "",
      signingSecret: "",
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
      // Empty means untouched, never cleared — the same contract the signing secret uses.
      key: data.key,
      providerName: data.providerName,
      isActive: data.isActive,
      issuer: data.issuer,
      audiences: splitAudiences(data.audiences),
      algorithms: [Number(data.algorithm) as JwtSigningAlgorithm],
      jwksUrl: symmetric ? undefined : data.jwksUrl,
      signingSecret: symmetric ? data.signingSecret : undefined,
      cookieKey: existing?.cookieKey,
      // Claim mapping is not asked for here: it is picked from a real token in "Map JWT claim",
      // where the provider's own claim names are on screen to choose from. A new provider starts
      // on the registered OIDC names so it is usable before anyone opens that drawer, and an
      // existing one carries its mapping through untouched.
      claimsMapping: existing?.claimsMapping ?? DEFAULT_CLAIMS_MAPPING,
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
          <div className="space-y-1.5">
            <Label htmlFor="provider-name">
              Provider
              <Required />
            </Label>
            <Select
              value={watch("providerName")}
              onValueChange={(value) => setValue("providerName", value, { shouldValidate: true })}
            >
              <SelectTrigger id="provider-name" aria-required>
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
            <Label htmlFor="provider-key">
              Key
              {!existing && <Required />}
            </Label>
            <Input
              id="provider-key"
              aria-required={!existing}
              autoComplete="off"
              placeholder={existing ? `${existing.key}  (leave blank to keep)` : "auth0-web"}
              {...register("key")}
            />
            <p className="text-xs text-muted-foreground">
              {existing
                ? "A key is set. Leave this blank to keep it, or type a new one to replace it."
                : "The value callers send as x-blocks-idp, if they ever need to."}
            </p>
            {formState.errors.key && (
              <p className="text-xs text-destructive">{formState.errors.key.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="provider-issuer">
              Issuer
              <Required />
            </Label>
            <Input
              id="provider-issuer"
              aria-required
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

          <div className="space-y-1.5">
            <Label htmlFor="provider-algorithm">
              Signing algorithm
              <Required />
            </Label>
            <Select
              value={String(algorithm)}
              onValueChange={(value) => setValue("algorithm", Number(value))}
            >
              <SelectTrigger id="provider-algorithm" aria-required>
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

          <div className="flex items-center justify-between rounded-sm border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="provider-active" className="text-sm">
                Status
              </Label>
              <p className="text-xs text-muted-foreground">
                Tokens from an inactive provider are not accepted.
              </p>
            </div>
            <Switch
              id="provider-active"
              size="md"
              checked={watch("isActive")}
              onCheckedChange={(checked) => setValue("isActive", checked)}
            />
          </div>

          {symmetric ? (
            <div className="space-y-1.5">
              <Label htmlFor="provider-secret">
                Signing secret
                {!existing?.hasSigningSecret && <Required />}
              </Label>
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
              <Label htmlFor="provider-jwks">
                JWKS URL
                <Required />
              </Label>
              <Input
                id="provider-jwks"
                aria-required
                placeholder="https://your-tenant.us.auth0.com/.well-known/jwks.json"
                {...register("jwksUrl")}
              />
              <p className="text-xs text-muted-foreground">
                Public keys, fetched over HTTPS. No secret is stored for this algorithm.
              </p>
            </div>
          )}

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
