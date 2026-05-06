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
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CAPTCHA_GENERATOR_TYPE, CAPTCHA_PROVIDERS } from "@blocks-idp/captcha/models/captcha";
import { providers } from "@blocks-idp/authentication/constants/authentication.constant";
import {
  SecretType,
  SECRET_TYPE_OPTIONS,
  type AddSecretPayload,
  type CaptchaSecretValue,
  type ExternalIdPSecretValue,
  type OIDCSecretValue,
  type SSOSecretValue,
} from "../../constants/secret-key.enum";

// ─── Schemas ────────────────────────────────────────────────────────────────

const oidcSchema = z.object({
  clientDisplayName: z.string().min(1, "Client name is required"),
  redirectUri: z.string().url("Must be a valid URL"),
  audience: z.string().url("Must be a valid URL"),
  clientBrandColor: z.string().default("#124091"),
  clientLogoUrl: z.string().optional().default(""),
});

const captchaSchema = z.object({
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
}: {
  submitRef: React.RefObject<HTMLButtonElement>;
  onSubmit: (v: OIDCSecretValue) => void;
}) {
  const form = useForm({ resolver: zodResolver(oidcSchema), defaultValues: { clientDisplayName: "", redirectUri: "", audience: "", clientBrandColor: "#124091", clientLogoUrl: "" } });

  const handle = form.handleSubmit((data) => {
    onSubmit({ ClientDisplayName: data.clientDisplayName, RedirectUri: data.redirectUri, Audience: data.audience, ClientBrandColor: data.clientBrandColor, ClientLogoUrl: data.clientLogoUrl ?? "" });
  });

  return (
    <Form {...form}>
      <form id="secret-form" onSubmit={handle} className="space-y-4">
        <FormField control={form.control} name="clientDisplayName" render={({ field }) => (
          <FormItem><FormLabel>Client Name</FormLabel><FormControl><Input placeholder="Enter client name" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="redirectUri" render={({ field }) => (
          <FormItem><FormLabel>Redirect URL</FormLabel><FormControl><Input placeholder="https://example.com/oidc" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="audience" render={({ field }) => (
          <FormItem><FormLabel>Audience</FormLabel><FormControl><Input placeholder="https://example.com" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
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
        <FormField control={form.control} name="clientLogoUrl" render={({ field }) => (
          <FormItem>
            <FormLabel>Logo URL (Optional)</FormLabel>
            <FormControl>
              <Input type="url" placeholder="https://example.com/logo.png" value={field.value} onChange={field.onChange} />
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
}: {
  submitRef: React.RefObject<HTMLButtonElement>;
  onSubmit: (v: CaptchaSecretValue) => void;
}) {
  const form = useForm({ resolver: zodResolver(captchaSchema), defaultValues: { captchaProvider: "", captchaSiteKey: "", captchaSecretKey: "", captchaGeneratorType: "" } });

  const handle = form.handleSubmit((data) => {
    onSubmit({ CaptchaProvider: data.captchaProvider, CaptchaSiteKey: data.captchaSiteKey, CaptchaSecretKey: data.captchaSecretKey, CaptchaGeneratorType: data.captchaGeneratorType });
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
        <button ref={submitRef} type="submit" className="hidden" />
      </form>
    </Form>
  );
}

// ─── Sub-form: SSO ──────────────────────────────────────────────────────────

function SSOForm({
  submitRef,
  onSubmit,
}: {
  submitRef: React.RefObject<HTMLButtonElement>;
  onSubmit: (v: SSOSecretValue) => void;
}) {
  const [showSecret, setShowSecret] = useState(false);
  const form = useForm({ resolver: zodResolver(ssoSchema), defaultValues: { clientId: "", clientSecret: "", redirectUrl: "", audience: "", wellKnownUrl: "" } });

  const handle = form.handleSubmit((data) => {
    onSubmit({ ClientId: data.clientId, ClientSecret: data.clientSecret, RedirectUrl: data.redirectUrl, Audience: data.audience, WellKnownUrl: data.wellKnownUrl });
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
}: {
  submitRef: React.RefObject<HTMLButtonElement>;
  onSubmit: (v: ExternalIdPSecretValue) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm({ resolver: zodResolver(externalIdpSchema), defaultValues: { providerName: "", url: "", issuer: "", audiences: "", password: "" } });

  const handle = form.handleSubmit((data) => {
    const isJwks = data.url?.startsWith("https://") && !data.url?.endsWith(".crt") && !data.url?.endsWith(".pem");
    onSubmit({ ProviderName: data.providerName, JwksUrl: isJwks ? (data.url ?? "") : "", PublicCertificatePath: isJwks ? "" : (data.url ?? ""), Issuer: data.issuer ?? "", Audiences: data.audiences ?? "", Password: data.password ?? "" });
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

type AddSecretModalProps = {
  onSave?: (payload: AddSecretPayload) => void;
};

export function AddSecretModal({ onSave }: AddSecretModalProps) {
  const [open, setOpen] = useState(false);
  const [secretType, setSecretType] = useState<SecretType>(SecretType.Captcha);
  const submitRef = useRef<HTMLButtonElement>(null);

  const handleSecretTypeChange = (value: SecretType) => {
    setSecretType(value);
  };

  const handleSubFormSubmit = (value: AddSecretPayload["Value"]) => {
    const payload = { SecretType: secretType, Value: value } as AddSecretPayload;
    onSave?.(payload);
    setOpen(false);
    setSecretType(SecretType.Captcha);
  };

  const handleSave = () => {
    submitRef.current?.click();
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) setSecretType(SecretType.Captcha);
    setOpen(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="aspect-square w-4" />
        <span className="ml-2">Add Secret</span>
      </Button>

      <DialogContent className="flex max-h-[85vh] w-[95vw] max-w-lg flex-col sm:w-full">
        <DialogHeader>
          <DialogTitle>Add Secret</DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-1 pb-1">
          {/* Secret Type Selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium leading-none">Secret Type</label>
            <Select value={secretType} onValueChange={handleSecretTypeChange}>
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

          {/* Dynamic form content */}
          {secretType === SecretType.OIDC && (
            <OIDCForm key="oidc" submitRef={submitRef} onSubmit={handleSubFormSubmit} />
          )}
          {secretType === SecretType.Captcha && (
            <CaptchaForm key="captcha" submitRef={submitRef} onSubmit={handleSubFormSubmit} />
          )}
          {secretType === SecretType.SSO && (
            <SSOForm key="sso" submitRef={submitRef} onSubmit={handleSubFormSubmit} />
          )}
          {secretType === SecretType.ExternalIdP && (
            <ExternalIdPForm key="extidp" submitRef={submitRef} onSubmit={handleSubFormSubmit} />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
