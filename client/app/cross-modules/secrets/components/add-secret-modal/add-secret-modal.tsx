import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { Input } from "@/components/ui-kits/input/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui-kits/radio-group/radio-group";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Eye, EyeOff, Plus, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useGetPreSignedUrlForUpload, useUploadFile } from "@blocks-storage/hooks/use-storage-file";
import { storageService } from "@blocks-storage/services/storage.service";
import { ModuleName } from "@/constants/modules.constants";
import { useProjectStore } from "@/store/useProjectStore";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { CAPTCHA_GENERATOR_TYPE, CAPTCHA_PROVIDERS } from "@blocks-idp/captcha/models/captcha";
import { providers } from "@blocks-idp/authentication/constants/authentication.constant";
import {
  SecretType,
  SECRET_TYPE_OPTIONS,
  type CaptchaSecretValue,
  type ExternalIdPSecretValue,
  type OIDCSecretValue,
  type SecretItem,
  type SSOSecretValue,
} from "../../constants/secret-key.enum";
import { useSaveSecret } from "../../hooks/use-secrets";

const getInitialValue = (initialValues: Record<string, string> | undefined, ...keys: string[]) => {
  if (!initialValues) return "";
  for (const key of keys) {
    if (initialValues[key] !== undefined) return initialValues[key];
    const lowerCased = key.charAt(0).toLowerCase() + key.slice(1);
    if (initialValues[lowerCased] !== undefined) return initialValues[lowerCased];
  }
  return "";
};

const resolveSecretType = (value?: string): SecretType => {
  const matched = Object.values(SecretType).find(
    (type) => type.toLowerCase() === (value ?? "").toLowerCase(),
  );
  return matched ?? SecretType.Captcha;
};
// ─── Schemas ────────────────────────────────────────────────────────────────
const oidcSchema = z.object({
  clientDisplayName: z.string().min(1, "Client name is required"),
  redirectUri: z.string().url("Must be a valid URL"),
  audience: z.string().url("Must be a valid URL"),
  scope: z.string().min(1, "Scope is required").default("openid"),
  isAutoRedirect: z.string().default("false"),
  clientBrandColor: z.string().default("#124091"),
  clientSecret: z.string().optional().default(""),
});
const captchaSchema = z.object({
  isEnable: z.string().default("false"),
  captchaProvider: z.string().min(1, "Provider is required"),
  captchaSiteKey: z.string().min(1, "Site key is required"),
  captchaSecretKey: z.string().min(1, "Secret key is required"),
  captchaGeneratorType: z.string().min(1, "Generator type is required"),
});
const ssoSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  clientSecret: z.string().min(1, "Client secret is required"),
  redirectUrl: z.string().url("Must be a valid URL"),
  audience: z.string().optional().default(""),
  wellKnownUrl: z.string().url("Must be a valid URL"),
});
const externalIdpSchema = z.object({
  providerName: z.string().min(1, "Provider name is required"),
  url: z.string().optional().default(""),
  issuer: z.string().optional().default(""),
  audiences: z.string().optional().default(""),
  password: z.string().optional().default(""),
});
// ─── Sub-form: OIDC ─────────────────────────────────────────────────────────
function OIDCForm({
  submitRef,
  onSubmit,
  initialValues,
}: {
  submitRef: React.RefObject<HTMLButtonElement>;
  onSubmit: (v: Record<string, string>) => void;
  initialValues?: Record<string, string>;
}) {
  const [showSecret, setShowSecret] = useState(false);
  const tenantId = useProjectStore().selectedProject?.tenantId ?? "";
  const [clientLogoUrl, setClientLogoUrl] = useState(getInitialValue(initialValues, "clientLogoUrl"));
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: getPreSign } = useGetPreSignedUrlForUpload();
  const { mutateAsync: uploadFile } = useUploadFile();
  const MAX_LOGO_FILE_SIZE = 5 * 1024 * 1024;

  const form = useForm({
    resolver: zodResolver(oidcSchema),
    defaultValues: {
      clientDisplayName: getInitialValue(initialValues, "clientDisplayName"),
      redirectUri: getInitialValue(initialValues, "redirectUri"),
      audience: getInitialValue(initialValues, "audience"),
      scope: getInitialValue(initialValues, "scope") || "openid",
      isAutoRedirect: getInitialValue(initialValues, "isAutoRedirect") || "false",
      clientBrandColor: getInitialValue(initialValues, "clientBrandColor") || "#124091",
      clientSecret: getInitialValue(initialValues, "clientSecret"),
    },
  });

  useEffect(() => {
    if (!initialValues) return;
    setClientLogoUrl(getInitialValue(initialValues, "clientLogoUrl"));
  }, [initialValues]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
    const allowedExts = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
    if (!allowedTypes.includes(file.type) && !allowedExts.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      showErrorToast({ errors: "Invalid file type. Only JPG, PNG, GIF, WEBP, SVG allowed." });
      e.target.value = "";
      return;
    }
    if (file.size > MAX_LOGO_FILE_SIZE) {
      showErrorToast({ errors: "Image size must be under 5 MB." });
      e.target.value = "";
      return;
    }
    try {
      setIsUploadingImage(true);
      const preSign = await getPreSign({ accessModifier: "Public", configurationName: "Default", name: file.name, projectKey: tenantId, tags: "", metaData: "", parentDirectoryId: "", moduleName: ModuleName.IAMCloud });
      if (!preSign.isSuccess) throw new Error("Failed to get upload URL");
      await uploadFile({ url: preSign.uploadUrl, file });
      const fileInfo = await storageService.file.getFileByFileId({ itemId: preSign.fileId, projectKey: tenantId });
      setClientLogoUrl(fileInfo.url);
      showSuccessToast({ description: "Logo uploaded successfully" });
    } catch (err: unknown) {
      if (isErrorWithErrors(err)) return showErrorToast({ errors: err.errors });
      showErrorToast({ errors: "Something went wrong uploading logo" });
    } finally {
      setIsUploadingImage(false);
      e.target.value = "";
    }
  };

  const handle = form.handleSubmit((data) => {
    onSubmit({ clientDisplayName: data.clientDisplayName, redirectUri: data.redirectUri, audience: data.audience, scope: data.scope, isAutoRedirect: data.isAutoRedirect, clientBrandColor: data.clientBrandColor, clientLogoUrl: clientLogoUrl, clientSecret: data.clientSecret } satisfies OIDCSecretValue as unknown as Record<string, string>);
  });
  return (
    <Form {...form}>
      <form id="secret-form" onSubmit={handle} className="space-y-4">
        <FormField control={form.control} name="clientDisplayName" render={({ field }) => (
          <FormItem><FormLabel>Client Name</FormLabel><FormControl><Input placeholder="Enter client name" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="clientSecret" render={({ field }) => (
          <FormItem>
            <FormLabel>Client Secret</FormLabel>
            <FormControl>
              <div className="relative">
                <Input type={showSecret ? "text" : "password"} placeholder="Enter client secret" {...field} />
                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowSecret(!showSecret)}>
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="redirectUri" render={({ field }) => (
          <FormItem><FormLabel>Redirect URL</FormLabel><FormControl><Input placeholder="https://example.com/oidc" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="audience" render={({ field }) => (
          <FormItem><FormLabel>Audience</FormLabel><FormControl><Input placeholder="https://example.com" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Logo Upload */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Client Logo</label>
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-dashed border-border bg-muted">
                {clientLogoUrl ? (
                  <img src={clientLogoUrl} alt="Client Logo" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Camera className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                {isUploadingImage && <div className="absolute inset-0 flex items-center justify-center bg-muted/60 text-xs text-muted-foreground">...</div>}
              </div>
              <div className="flex flex-col gap-2">
                <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.gif,.webp,.svg" onChange={handleImageUpload} className="hidden" />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploadingImage}>Upload</Button>
                {clientLogoUrl && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setClientLogoUrl("")}>Remove</Button>
                )}
              </div>
            </div>
          </div>
          {/* Brand Color */}
          <FormField control={form.control} name="clientBrandColor" render={({ field }) => (
            <FormItem>
              <FormLabel>Brand Color</FormLabel>
              <FormControl>
                <div className="flex items-center gap-2">
                  <input type="color" value={field.value} onChange={(e) => field.onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-input bg-transparent p-1" />
                  <Input placeholder="#124091" value={field.value} onChange={field.onChange} className="flex-1" />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="isAutoRedirect" render={({ field }) => (
          <FormItem>
            <FormControl>
              <div className="flex items-center gap-6">
                <FormLabel className="mb-0">Auto Redirect</FormLabel>
                <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="true" id="oidc-autoredirect-yes" />
                    <label htmlFor="oidc-autoredirect-yes" className="cursor-pointer text-sm font-medium">Yes</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="false" id="oidc-autoredirect-no" />
                    <label htmlFor="oidc-autoredirect-no" className="cursor-pointer text-sm font-medium">No</label>
                  </div>
                </RadioGroup>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <button ref={submitRef} type="submit" className="hidden" />
      </form>
    </Form>
  );
}
// ─── Sub-form: Captcha ───────────────────────────────────────────────────────
function CaptchaForm({
  submitRef,
  onSubmit,
  initialValues,
}: {
  submitRef: React.RefObject<HTMLButtonElement>;
  onSubmit: (v: Record<string, string>) => void;
  initialValues?: Record<string, string>;
}) {
  const form = useForm({
    resolver: zodResolver(captchaSchema),
    defaultValues: {
      isEnable: getInitialValue(initialValues, "isEnable") || "false",
      captchaProvider: getInitialValue(initialValues, "provider"),
      captchaSiteKey: getInitialValue(initialValues, "captchaKey"),
      captchaSecretKey: getInitialValue(initialValues, "captchaSecret"),
      captchaGeneratorType: getInitialValue(initialValues, "captchaGenerator"),
    },
  });
  const handle = form.handleSubmit((data) => {
    onSubmit({
      isEnable: data.isEnable,
      provider: data.captchaProvider,
      captchaKey: data.captchaSiteKey,
      captchaSecret: data.captchaSecretKey,
      captchaGenerator: data.captchaGeneratorType,
    });
  });
  return (
    <Form {...form}>
      <form id="secret-form" onSubmit={handle} className="space-y-4">
        <FormField control={form.control} name="captchaProvider" render={({ field }) => (
          <FormItem>
            <FormLabel>Captcha Provider</FormLabel>
            <FormControl>
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                <SelectContent>
                  {Object.values(CAPTCHA_PROVIDERS).map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="captchaSiteKey" render={({ field }) => (
          <FormItem><FormLabel>Site Key</FormLabel><FormControl><Input placeholder="Enter site key" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="captchaSecretKey" render={({ field }) => (
          <FormItem><FormLabel>Secret Key</FormLabel><FormControl><Input placeholder="Enter secret key" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="captchaGeneratorType" render={({ field }) => (
          <FormItem>
            <FormLabel>CAPTCHA Generator Type</FormLabel>
            <FormControl>
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {Object.values(CAPTCHA_GENERATOR_TYPE).map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="isEnable" render={({ field }) => (
          <FormItem>
            <FormControl>
              <div className="flex items-center gap-6">
                <FormLabel className="mb-0">Enable Captcha</FormLabel>
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex gap-6"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="true" id="captcha-enable-yes" />
                    <label htmlFor="captcha-enable-yes" className="cursor-pointer text-sm font-medium">Yes</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="false" id="captcha-enable-no" />
                    <label htmlFor="captcha-enable-no" className="cursor-pointer text-sm font-medium">No</label>
                  </div>
                </RadioGroup>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <button ref={submitRef} type="submit" className="hidden" />
      </form>
    </Form>
  );
}
// ─── Sub-form: SSO ──────────────────────────────────────────────────────────
function SSOForm({
  submitRef,
  onSubmit,
  initialValues,
}: {
  submitRef: React.RefObject<HTMLButtonElement>;
  onSubmit: (v: Record<string, string>) => void;
  initialValues?: Record<string, string>;
}) {
  const [showSecret, setShowSecret] = useState(false);
  const form = useForm({
    resolver: zodResolver(ssoSchema),
    defaultValues: {
      clientId: getInitialValue(initialValues, "clientId", "ClientId"),
      clientSecret: getInitialValue(initialValues, "clientSecret", "ClientSecret"),
      redirectUrl: getInitialValue(initialValues, "redirectUrl", "RedirectUrl"),
      audience: getInitialValue(initialValues, "audience", "Audience"),
      wellKnownUrl: getInitialValue(initialValues, "wellKnownUrl", "WellKnownUrl"),
    },
  });
  const handle = form.handleSubmit((data) => {
    onSubmit({ ClientId: data.clientId, ClientSecret: data.clientSecret, RedirectUrl: data.redirectUrl, Audience: data.audience, WellKnownUrl: data.wellKnownUrl } satisfies SSOSecretValue as unknown as Record<string, string>);
  });
  return (
    <Form {...form}>
      <form id="secret-form" onSubmit={handle} className="space-y-4">
        <FormField control={form.control} name="clientId" render={({ field }) => (
          <FormItem><FormLabel>Client ID</FormLabel><FormControl><Input placeholder="Enter client ID" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="clientSecret" render={({ field }) => (
          <FormItem>
            <FormLabel>Client Secret</FormLabel>
            <FormControl>
              <div className="relative">
                <Input type={showSecret ? "text" : "password"} placeholder="Enter client secret" {...field} />
                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowSecret(!showSecret)}>
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="redirectUrl" render={({ field }) => (
          <FormItem><FormLabel>Redirect URL</FormLabel><FormControl><Input placeholder="https://example.com/callback" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="audience" render={({ field }) => (
          <FormItem><FormLabel>Audience (Optional)</FormLabel><FormControl><Input placeholder="https://example.com" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="wellKnownUrl" render={({ field }) => (
          <FormItem><FormLabel>Well Known URL</FormLabel><FormControl><Input placeholder="https://example.com/.well-known/openid-configuration" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <button ref={submitRef} type="submit" className="hidden" />
      </form>
    </Form>
  );
}
// ─── Sub-form: External IdP ─────────────────────────────────────────────────
function ExternalIdPForm({
  submitRef,
  onSubmit,
  initialValues,
}: {
  submitRef: React.RefObject<HTMLButtonElement>;
  onSubmit: (v: Record<string, string>) => void;
  initialValues?: Record<string, string>;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm({
    resolver: zodResolver(externalIdpSchema),
    defaultValues: {
      providerName: getInitialValue(initialValues, "providerName", "ProviderName"),
      url:
        getInitialValue(initialValues, "jwksUrl", "JwksUrl") ||
        getInitialValue(initialValues, "publicCertificatePath", "PublicCertificatePath"),
      issuer: getInitialValue(initialValues, "issuer", "Issuer"),
      audiences: getInitialValue(initialValues, "audiences", "Audiences"),
      password: getInitialValue(initialValues, "password", "Password"),
    },
  });
  const handle = form.handleSubmit((data) => {
    const isJwks = data.url?.startsWith("https://") && !data.url?.endsWith(".crt") && !data.url?.endsWith(".pem");
    onSubmit({ ProviderName: data.providerName, JwksUrl: isJwks ? (data.url ?? "") : "", PublicCertificatePath: isJwks ? "" : (data.url ?? ""), Issuer: data.issuer ?? "", Audiences: data.audiences ?? "", Password: data.password ?? "" } satisfies ExternalIdPSecretValue as unknown as Record<string, string>);
  });
  return (
    <Form {...form}>
      <form id="secret-form" onSubmit={handle} className="space-y-4">
        <FormField control={form.control} name="providerName" render={({ field }) => (
          <FormItem>
            <FormLabel>Provider</FormLabel>
            <FormControl>
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="url" render={({ field }) => (
          <FormItem><FormLabel>JWKS / Certificate URL (Optional)</FormLabel><FormControl><Input placeholder="Enter JWKS or certificate URL" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="issuer" render={({ field }) => (
          <FormItem><FormLabel>Issuer (Optional)</FormLabel><FormControl><Input placeholder="Enter issuer" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="audiences" render={({ field }) => (
          <FormItem><FormLabel>Audience (Optional)</FormLabel><FormControl><Input placeholder="Enter audience (comma-separated)" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="password" render={({ field }) => (
          <FormItem>
            <FormLabel>Password (Optional)</FormLabel>
            <FormControl>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} placeholder="********" {...field} />
                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <button ref={submitRef} type="submit" className="hidden" />
      </form>
    </Form>
  );
}
// ─── Main Modal ──────────────────────────────────────────────────────────────
export function AddSecretModal({
  defaultSecretType,
  mode = "create",
  editItem,
  open,
  onOpenChange,
  hideTrigger = false,
}: {
  defaultSecretType?: SecretType;
  mode?: "create" | "edit";
  editItem?: SecretItem;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const isEditMode = mode === "edit";
  const initialType = resolveSecretType(editItem?.secretKey) || defaultSecretType || SecretType.Captcha;
  const [secretType, setSecretType] = useState<SecretType>(initialType);
  const submitRef = useRef<HTMLButtonElement>(null);
  const { mutate: saveSecret, isPending } = useSaveSecret();

  useEffect(() => {
    if (isEditMode && editItem?.secretKey) {
      setSecretType(resolveSecretType(editItem.secretKey));
      return;
    }
    if (!isOpen) {
      setSecretType(defaultSecretType ?? SecretType.Captcha);
    }
  }, [isEditMode, editItem?.secretKey, defaultSecretType, isOpen]);

  const setModalOpen = (value: boolean) => {
    if (open === undefined) {
      setInternalOpen(value);
    }
    onOpenChange?.(value);
  };

  const handleSecretTypeChange = (value: SecretType) => {
    setSecretType(value);
  };

  const handleSubFormSubmit = (value: Record<string, string>) => {
    saveSecret(
      {
        secretKey: secretType,
        keyValuePairs: value,
        ...(isEditMode && editItem?.itemId ? { itemId: editItem.itemId } : {}),
      },
      {
        onSuccess: () => {
          setModalOpen(false);
          setSecretType(defaultSecretType ?? SecretType.Captcha);
        },
      },
    );
  };
  const handleSave = () => {
    submitRef.current?.click();
  };
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSecretType(isEditMode && editItem?.secretKey ? resolveSecretType(editItem.secretKey) : (defaultSecretType ?? SecretType.Captcha));
    }
    setModalOpen(isOpen);
  };
  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="aspect-square w-4" />
          <span className="ml-2">Add Secret</span>
        </Button>
      )}
      <DialogContent className="flex max-h-[85vh] w-[95vw] max-w-lg flex-col sm:w-full">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Secret" : "Add Secret"}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 space-y-5 overflow-y-auto px-1 pb-1">
          <div className="space-y-1.5">
            <label className="text-sm font-medium leading-none">Secret Type</label>
            <Select value={secretType} onValueChange={handleSecretTypeChange} disabled={isEditMode}>
              <SelectTrigger>
                <SelectValue placeholder="Select secret type" />
              </SelectTrigger>
              <SelectContent>
                {SECRET_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {secretType === SecretType.OIDC && (
            <OIDCForm key={`oidc-${editItem?.itemId ?? "new"}`} submitRef={submitRef} onSubmit={handleSubFormSubmit} initialValues={editItem?.keyValuePairs} />
          )}
          {secretType === SecretType.Captcha && (
            <CaptchaForm key={`captcha-${editItem?.itemId ?? "new"}`} submitRef={submitRef} onSubmit={handleSubFormSubmit} initialValues={editItem?.keyValuePairs} />
          )}
          {secretType === SecretType.SSO && (
            <SSOForm key={`sso-${editItem?.itemId ?? "new"}`} submitRef={submitRef} onSubmit={handleSubFormSubmit} initialValues={editItem?.keyValuePairs} />
          )}
          {secretType === SecretType.ExternalIdP && (
            <ExternalIdPForm key={`extidp-${editItem?.itemId ?? "new"}`} submitRef={submitRef} onSubmit={handleSubFormSubmit} initialValues={editItem?.keyValuePairs} />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
