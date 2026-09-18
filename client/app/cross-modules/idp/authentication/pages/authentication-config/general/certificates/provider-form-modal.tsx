import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Paperclip, UploadCloud } from "lucide-react";
import {
  FileInput,
  FileUploader,
  FileUploaderContent,
  FileUploaderItem,
} from "@/components/file-uploader/file-uploader";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui-kits/radio-group/radio-group";
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
import { usePublicCertificateFile } from "@blocks-storage/hooks/use-storage-file";
import {
  canCarryPassphrase,
  certificateExtension,
  CERTIFICATE_DROPZONE_ACCEPT,
  CERTIFICATE_EXTENSIONS,
  CERTIFICATE_MAX_SIZE_BYTES,
  isCertificateFile,
  isSymmetric,
  JwtSigningAlgorithm,
  keySourceOf,
  SIGNING_ALGORITHMS,
  type AsymmetricKeySource,
  type ClaimsMapping,
  type ThirdPartyJwtProvider,
} from "@/cross-modules/identifier/models/third-party-jwt-provider.model";

const KEY_CHARACTERS = /^[A-Za-z0-9._-]+$/;
const KEY_CHARACTERS_MESSAGE = "Use letters, digits, dot, dash or underscore only";

/**
 * The two asymmetric key sources, as the radio group presents them.
 *
 * A plain list of options rather than hand-written markup per option: the label sits in a `Label`
 * bound by `htmlFor`, which is what makes the whole option clickable without nesting a second
 * button inside the radio item.
 */
const KEY_SOURCE_OPTIONS: { value: AsymmetricKeySource; id: string; label: string }[] = [
  { value: "jwks", id: "key-source-jwks", label: "JWKS URL" },
  { value: "certificate", id: "key-source-certificate", label: "Upload certificate" },
];

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
    // Optional: blank means "this provider receives the tokens that carry no iss claim".
    issuer: z.string().trim(),
    audiences: z.string().trim(),
    algorithm: z.coerce.number(),
    jwksUrl: z.string().trim(),
    signingSecret: z.string(),
    certificatePassphrase: z.string(),
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

/**
 * How a stored certificate is described back to the administrator.
 *
 * The blob is named after the tenant and provider, not after the file that was uploaded, so the
 * URL's last segment is an identifier rather than the name anyone recognises. Naming the kind of
 * file is both honest and the part that actually matters — whether it can carry a passphrase.
 */
const storedCertificateLabel = (path: string) => {
  const extension = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase();

  if (extension === "pfx" || extension === "p12") return "A PKCS#12 certificate is configured";
  if (extension) return `A certificate is configured (.${extension})`;

  return "A certificate is configured";
};

type ProviderFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: ThirdPartyJwtProvider | null;
  /** Issuers already in use by other active providers, for the shared-issuer warning. */
  siblingIssuers?: string[];
  /** Tenant the certificate is uploaded under. */
  projectKey: string;
};

export function ProviderFormModal({
  open,
  onOpenChange,
  existing,
  siblingIssuers = [],
  projectKey,
}: Readonly<ProviderFormModalProps>) {
  const { mutateAsync, isPending } = useSaveThirdPartyJwtProvider();
  const { mutateAsync: uploadCertificate, isPending: isUploading } = usePublicCertificateFile();

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
      certificatePassphrase: "",
    },
  });

  const { register, handleSubmit, watch, setValue, setError, formState } = form;
  const algorithm = Number(watch("algorithm")) as JwtSigningAlgorithm;
  const symmetric = isSymmetric(algorithm);
  const issuer = watch("issuer")?.trim();
  const audiences = watch("audiences")?.trim();

  const [certificateFiles, setCertificateFiles] = useState<File[]>([]);
  const [showPassphrase, setShowPassphrase] = useState(false);

  // Adjusted during render rather than in an effect, which is how this codebase mirrors a prop
  // into state. The modal instance is reused across providers, so a useState initializer alone
  // would leave the radio showing whichever provider was opened first.
  const [keySourceChoice, setKeySourceChoice] = useState<AsymmetricKeySource>(() =>
    existing ? keySourceOf(existing) : "jwks",
  );
  const [shownItemId, setShownItemId] = useState(existing?.itemId);
  if (shownItemId !== existing?.itemId) {
    setShownItemId(existing?.itemId);
    setKeySourceChoice(existing ? keySourceOf(existing) : "jwks");
    setCertificateFiles([]);
    setShowPassphrase(false);
  }

  // Which key source applies is decided by the algorithm family alone, never by which provider
  // was picked from the list. Brand is a leaky proxy for capability — a self-hosted Keycloak
  // often has no JWKS this platform can reach, and `ProviderName` is documented as carrying no
  // behaviour — so the choice is offered wherever it is cryptographically meaningful.
  //
  // Derived rather than mirrored into state by an effect: switching to HMAC has to fall back to a
  // JWKS, and computing it here means the two can never disagree. The choice itself is remembered,
  // so switching the algorithm back restores it.
  const keySource: AsymmetricKeySource = symmetric ? "jwks" : keySourceChoice;

  const storedCertificatePath = existing?.publicCertificatePath ?? "";
  const pendingCertificate = certificateFiles[0];
  // Keeping the stored certificate is only an option while the provider is still pointing at one;
  // switching away from a JWKS means a file has to be supplied.
  const keepsStoredCertificate = !pendingCertificate && !!storedCertificatePath;

  // A passphrase can only ever unlock a PKCS#12 container, so a freshly chosen file is judged on
  // its own name. A stored certificate is judged on `hasCertificatePassword` first: a blob
  // uploaded before the URL carried an extension ends in an opaque identifier, and going by the
  // path alone would say "no passphrase" on exactly the providers that have one to manage.
  //
  // This decides whether the field is *usable*, never whether it is *shown*. Hiding it until a
  // PKCS#12 happened to be selected meant nothing on screen said the capability existed, so
  // anyone with a protected .pfx had no reason to think they could use it here.
  const storedExtension = certificateExtension(storedCertificatePath);
  const passphraseUsable = pendingCertificate
    ? canCarryPassphrase(pendingCertificate.name)
    : !!existing?.hasCertificatePassword ||
      canCarryPassphrase(storedCertificatePath) ||
      // Nothing chosen yet, or a blob stored before the URL carried an extension. Either way the
      // file's type is unknown, and refusing a passphrase on a guess would lock out a protected
      // .pfx that is already configured.
      !storedExtension;

  // Two providers sharing an issuer AND an audience validate identically, so only the caller's
  // header could tell them apart — which hands the choice of claim mapping to the caller.
  //
  // Deliberately not applied to a blank issuer: a token with no `iss` carries no `aud` either, so
  // demanding audiences there would ask for the one thing that cannot help and would build a
  // provider nothing can reach. Those are separated by the header instead.
  const sharesIssuer = !!issuer && siblingIssuers.includes(issuer);
  const needsAudiences = sharesIssuer && !audiences;

  // How many other providers already accept issuer-less tokens, which is what decides whether
  // `x-blocks-idp` becomes mandatory for this one.
  const issuerlessSiblings = siblingIssuers.filter((s) => !s).length;

  /**
   * What the passphrase field says about itself.
   *
   * Advice, not a gate. The field stays editable even when the chosen file looks like a bare
   * certificate, because the file name is the only signal available -- DER and PKCS#12 both begin
   * with the same ASN.1 byte, so content cannot tell them apart cheaply. A protected .pfx saved
   * under a .crt name would otherwise hit a wall: the save is refused for wanting a passphrase
   * that the form would not let anyone type.
   *
   * Carries the rule rather than hiding the field when it does not apply: a `.crt` holds nothing
   * but a public key, so there is no passphrase to give, and saying that is more use than an
   * input that silently vanishes.
   */
  const passphraseHint = (() => {
    if (keepsStoredCertificate && existing?.hasCertificatePassword) {
      return "A passphrase is stored. Leave this blank to keep it, or type a new one to replace it.";
    }

    if (!passphraseUsable) {
      return "Not needed for this file — a .crt, .pem or .der holds only a public key, so there is nothing to unlock.";
    }

    if (pendingCertificate) {
      return "This PKCS#12 file may be password protected. Stored encrypted and never shown again.";
    }

    return "Only for a password-protected PKCS#12 (.pfx or .p12). Stored encrypted and never shown again.";
  })();

  // Stable for as long as this form is open, so a retry after a failed save overwrites the blob it
  // just wrote rather than leaving one orphaned per attempt. An existing provider uses its own id,
  // which keeps a re-upload replacing that provider's certificate in place.
  const uploadRefRef = useRef<string | null>(null);
  const uploadRef = () => {
    if (existing?.itemId) return existing.itemId;
    uploadRefRef.current ??= crypto.randomUUID();
    return uploadRefRef.current;
  };

  const closeAndReset = (isOpen: boolean) => {
    if (!isOpen) {
      setCertificateFiles([]);
      setShowPassphrase(false);
      uploadRefRef.current = null;
    }
    onOpenChange(isOpen);
  };

  /**
   * Turns the chosen key source into the fields the save expects.
   *
   * Returns `null` when something is missing or the upload failed, having already reported it —
   * exactly one key source may be sent, so there is no partial payload worth submitting.
   */
  const resolveKeySource = async (data: FormData) => {
    if (symmetric) {
      return { signingSecret: data.signingSecret };
    }

    if (keySource === "jwks") {
      if (!data.jwksUrl) {
        setError("jwksUrl", { message: "A JWKS URL is required for this algorithm" });
        return null;
      }

      return { jwksUrl: data.jwksUrl };
    }

    if (keepsStoredCertificate) {
      return {
        publicCertificatePath: storedCertificatePath,
        // Empty means untouched, so the stored passphrase survives unless a new one is typed.
        publicCertificatePassword: data.certificatePassphrase || undefined,
      };
    }

    if (!pendingCertificate) {
      showErrorToast({ errors: "Upload a certificate, or switch this provider to a JWKS URL." });
      return null;
    }

    // The server checks this too; failing here keeps a doomed upload off the wire and names the
    // extensions rather than answering with a code.
    if (!isCertificateFile(pendingCertificate.name)) {
      showErrorToast({
        errors: `Only certificate files are allowed (${CERTIFICATE_EXTENSIONS.join(", ")})`,
      });
      return null;
    }

    const uploaded = await uploadCertificate({
      TenantId: projectKey,
      file: pendingCertificate,
      ProviderRef: uploadRef(),
    });

    if (!uploaded?.downloadUrl) {
      showErrorToast({ errors: "The certificate could not be stored, so nothing was saved." });
      return null;
    }

    return {
      publicCertificatePath: uploaded.downloadUrl,
      publicCertificatePassword: data.certificatePassphrase || undefined,
      // A fresh certificate makes the stored passphrase wrong by definition, and the upload
      // reuses the same URL, so the server cannot infer the change from the path alone.
      clearCertificatePassword: !data.certificatePassphrase,
    };
  };

  const onSubmit = async (data: FormData) => {
    const keyFields = await resolveKeySource(data);
    if (!keyFields) return;

    const result = await mutateAsync({
      itemId: existing?.itemId,
      // Empty means untouched, never cleared — the same contract the signing secret uses.
      key: data.key,
      providerName: data.providerName,
      isActive: data.isActive,
      issuer: data.issuer,
      audiences: splitAudiences(data.audiences),
      algorithms: [Number(data.algorithm) as JwtSigningAlgorithm],
      ...keyFields,
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
    closeAndReset(false);
  };

  const isSaving = isPending || isUploading;

  return (
    <Dialog open={open} onOpenChange={closeAndReset}>
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
            <Label htmlFor="provider-issuer">Issuer</Label>
            <Input
              id="provider-issuer"
              placeholder="https://your-tenant.us.auth0.com/"
              {...register("issuer")}
            />
            <p className="text-xs text-muted-foreground">
              Matched exactly against the token&apos;s <code className="font-mono">iss</code>,
              trailing slash included. Leave it empty only if this provider&apos;s tokens carry no{" "}
              <code className="font-mono">iss</code> at all — a blank issuer accepts those and
              nothing else.
            </p>
            {!issuer && (
              <p className="text-xs text-muted-foreground">
                {issuerlessSiblings > 0
                  ? `Another provider already accepts tokens without an issuer, so callers must send x-blocks-idp: ${
                      existing?.key ?? "this provider's key"
                    } to reach this one.`
                  : "Tokens carrying any issuer will not reach this provider."}
              </p>
            )}
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

          {symmetric && (
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
          )}

          {!symmetric && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">
                  Key source
                  <Required />
                </Label>
                <RadioGroup
                  value={keySource}
                  onValueChange={(value) => setKeySourceChoice(value as AsymmetricKeySource)}
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {KEY_SOURCE_OPTIONS.map((option) => (
                      <div
                        key={option.value}
                        className={`flex items-center gap-2 rounded-md border p-3 ${
                          keySource === option.value
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
                <p className="text-xs text-muted-foreground">
                  A JWKS survives the provider rotating a key; a certificate pins exactly one, so it
                  has to be re-uploaded when they rotate. Prefer a JWKS wherever the provider
                  publishes one — upload a certificate for an issuer that publishes none.
                </p>
              </div>

              {keySource === "jwks" ? (
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
                  {formState.errors.jwksUrl && (
                    <p className="text-xs text-destructive">{formState.errors.jwksUrl.message}</p>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label>
                      Certificate
                      {!storedCertificatePath && <Required />}
                    </Label>
                    <FileUploader
                      value={certificateFiles}
                      onValueChange={(files) => setCertificateFiles(files ?? [])}
                      dropzoneOptions={{
                        accept: CERTIFICATE_DROPZONE_ACCEPT,
                        maxFiles: 1,
                        multiple: false,
                        maxSize: CERTIFICATE_MAX_SIZE_BYTES,
                      }}
                      className="rounded-lg"
                    >
                      <FileInput className="rounded-lg border border-dashed border-border/70 bg-muted/10">
                        <div className="flex w-full flex-col items-center justify-center gap-2 py-8">
                          <UploadCloud className="h-6 w-6 text-muted-foreground" />
                          <p className="text-sm font-medium text-foreground">
                            Click to upload or drag and drop
                          </p>
                          <p className="text-center text-[10px] leading-tight text-muted-foreground">
                            Certificate files ({CERTIFICATE_EXTENSIONS.join(", ")}) up to 2 MB
                          </p>
                        </div>
                      </FileInput>
                      <FileUploaderContent>
                        {certificateFiles.map((file, index) => (
                          <FileUploaderItem
                            key={`${file.name}-${index}`}
                            index={index}
                            className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
                          >
                            <Paperclip className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate text-foreground">{file.name}</span>
                          </FileUploaderItem>
                        ))}
                      </FileUploaderContent>
                    </FileUploader>
                    <p className="text-xs text-muted-foreground">
                      {keepsStoredCertificate
                        ? `${storedCertificateLabel(storedCertificatePath)}. Upload a file to replace it.`
                        : "The provider's public certificate. Stored where token validation can read it back."}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="provider-certificate-passphrase">Passphrase (optional)</Label>
                    <div className="relative">
                      <Input
                        id="provider-certificate-passphrase"
                        type={showPassphrase ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder={
                          keepsStoredCertificate && existing?.hasCertificatePassword
                            ? "••••••••  (leave blank to keep)"
                            : ""
                        }
                        {...register("certificatePassphrase")}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={showPassphrase ? "Hide passphrase" : "Show passphrase"}
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassphrase(!showPassphrase)}
                      >
                        {showPassphrase ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">{passphraseHint}</p>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => closeAndReset(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {existing ? "Save changes" : "Add provider"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
