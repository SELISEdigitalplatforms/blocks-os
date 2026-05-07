import { ReactNode, useState } from "react";
import { useQueryState } from "nuqs";
import { KeyRound, Pencil, Power } from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { MaskedText } from "@/components/masked-text";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { format } from "date-fns";
import { getApiUrl } from "@/lib/get-api-path";
import { useProjectStore } from "@/store/useProjectStore";
import { CAPTCHA_PROVIDERS } from "@blocks-idp/captcha/models/captcha";
import { AddSecretModal } from "../add-secret-modal/add-secret-modal";
import { SecretType, SECRET_TYPE_OPTIONS, type SecretItem } from "../../constants/secret-key.enum";
import { useGetSecrets, useSaveSecret } from "../../hooks/use-secrets";

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
const LoadingSkeleton = () => (
  <div className="grid gap-4">
    {Array.from({ length: 3 }).map((_, i) => (
      <Card key={i}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32 rounded" />
            <Skeleton className="h-6 w-20 rounded" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="space-y-1">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-5 w-36 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyState = ({ label }: { label: string }) => (
  <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-card text-center text-muted-foreground">
    <KeyRound className="h-8 w-8 opacity-40" />
    <p className="text-sm">No {label} secrets found.</p>
  </div>
);

// ─── Item ─────────────────────────────────────────────────────────────────────
const Item = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="min-w-0">
    <p className="mb-2 text-sm font-medium text-low-emphasis">{label}</p>
    <div className="break-words text-base font-normal text-high-emphasis">{children}</div>
  </div>
);

// ─── Helper: read kv by camel or pascal key ───────────────────────────────────
function kv(pairs: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    if (pairs[k] !== undefined) return pairs[k];
    const lk = k.charAt(0).toLowerCase() + k.slice(1);
    if (pairs[lk] !== undefined) return pairs[lk];
  }
  return "";
}

// ─── OIDC Card ────────────────────────────────────────────────────────────────
const OIDCSecretCard = ({ item }: { item: SecretItem }) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const pairs = item.keyValuePairs ?? {};
  const displayName = kv(pairs, "clientDisplayName") || item.itemId;
  const logoUrl = kv(pairs, "clientLogoUrl");
  const redirectUri = kv(pairs, "redirectUri");
  const audience = kv(pairs, "audience");
  const scope = kv(pairs, "scope");
  const brandColor = kv(pairs, "clientBrandColor");
  const clientSecret = kv(pairs, "clientSecret");
  const wellKnownUrl = `${getApiUrl("idp/v1", ".well-known/openid-configuration")}?projectKey=${tenantId}`;

  return (
    <>
      <Card className="py-6">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {logoUrl && (
              <div className="relative h-12 w-12 overflow-hidden rounded-lg">
                <img src={logoUrl} alt="OIDC Logo" className="object-cover" />
              </div>
            )}
            <CardTitle>{displayName}</CardTitle>
          </div>
          <button onClick={() => setShowEditModal(true)} className="inline-flex items-center justify-center rounded-md hover:bg-accent h-9 w-9">
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Item label="Client Id">
              <CopyToClipboardButton textToCopy={item.itemId}>
                <MaskedText text={item.itemId} length={30} showFirstN={4} showLastN={4} />
              </CopyToClipboardButton>
            </Item>
            <Item label="Client Secret">
              <CopyToClipboardButton textToCopy={clientSecret}>
                <MaskedText text={clientSecret} length={30} showFirstN={4} showLastN={4} />
              </CopyToClipboardButton>
            </Item>
            <Item label="Redirect URL">
              <CopyToClipboardButton textToCopy={redirectUri}>
                {redirectUri}
              </CopyToClipboardButton>
            </Item>
            <Item label="Audience">
              <CopyToClipboardButton textToCopy={audience}>
                <div className="flex items-center gap-2">
                  <div className="flex flex-wrap gap-1.5">{audience}</div>
                </div>
              </CopyToClipboardButton>
            </Item>
            <Item label="Scope(s)">
              <div className="flex items-center gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {scope ? (
                    <Badge variant="secondary" className="text-xs">{scope}</Badge>
                  ) : (
                    <span>N/A</span>
                  )}
                </div>
              </div>
            </Item>
            <Item label="Created on">
              <span className="whitespace-nowrap">
                {item.createdDate ? format(new Date(item.createdDate), "dd/MM/yyyy HH:mm") : "N/A"}
              </span>
            </Item>
            <Item label="Theme Color">
              <div className="flex items-center gap-3">
                {brandColor && (
                  <div
                    className="h-8 w-8 rounded-lg border border-border"
                    style={{ backgroundColor: brandColor }}
                    title={brandColor}
                  />
                )}
                <span className="font-mono">{brandColor || "N/A"}</span>
              </div>
            </Item>
            <div className="md:col-span-2">
              <Item label="Well Known URL">
                <CopyToClipboardButton textToCopy={wellKnownUrl}>
                  <span className="break-all">{wellKnownUrl}</span>
                </CopyToClipboardButton>
              </Item>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    <AddSecretModal
      mode="edit"
      editItem={item}
      defaultSecretType={SecretType.OIDC}
      open={showEditModal}
      onOpenChange={setShowEditModal}
      hideTrigger
    />
    </>
  );
};

// ─── Captcha Card ─────────────────────────────────────────────────────────────
const CaptchaSecretCard = ({ item }: { item: SecretItem }) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [isTogglingEnable, setIsTogglingEnable] = useState(false);
  const { mutate: saveSecret } = useSaveSecret();
  const pairs = item.keyValuePairs ?? {};
  const provider = kv(pairs, "provider") as keyof typeof CAPTCHA_PROVIDERS;
  const providerLabel = CAPTCHA_PROVIDERS[provider]?.label ?? provider;
  const isEnable = kv(pairs, "isEnable") === "true";
  const captchaKey = kv(pairs, "captchaKey");
  const captchaSecret = kv(pairs, "captchaSecret");
  const createdAt = item.createdDate ? format(new Date(item.createdDate), "dd/MM/yyyy HH:mm") : null;

  const handleToggleEnable = () => {
    setIsTogglingEnable(true);
    saveSecret(
      {
        secretKey: SecretType.Captcha,
        keyValuePairs: {
          ...pairs,
          isEnable: (!isEnable).toString(),
        },
        itemId: item.itemId,
      },
      {
        onSuccess: () => {
          setIsTogglingEnable(false);
        },
        onError: () => {
          setIsTogglingEnable(false);
        },
      },
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle>{providerLabel || "Captcha"}</CardTitle>
              {isEnable && (
                <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100 h-fit">
                  Active
                </Badge>
              )}
            </div>
            {createdAt && <p className="mt-0.5 text-xs text-muted-foreground">Created {createdAt}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleToggleEnable}
              disabled={isTogglingEnable}
              className={`inline-flex items-center justify-center rounded-md hover:bg-accent h-9 w-9 transition-colors ${
                isEnable ? "text-green-700" : "text-muted-foreground"
              } disabled:opacity-50`}
              title={isEnable ? "Disable" : "Enable"}
            >
              <Power className="h-4 w-4" />
            </button>
            <button onClick={() => setShowEditModal(true)} className="inline-flex items-center justify-center rounded-md hover:bg-accent h-9 w-9">
              <Pencil className="h-4 w-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Item label="Site Key">
              <CopyToClipboardButton textToCopy={captchaKey}>
                <MaskedText text={captchaKey} length={30} />
              </CopyToClipboardButton>
            </Item>
            <Item label="Secret Key">
              <CopyToClipboardButton textToCopy={captchaSecret}>
                <MaskedText text={captchaSecret} length={30} />
              </CopyToClipboardButton>
            </Item>
          </div>
        </CardContent>
      </Card>
      <AddSecretModal
        mode="edit"
        editItem={item}
        defaultSecretType={SecretType.Captcha}
        open={showEditModal}
        onOpenChange={setShowEditModal}
        hideTrigger
      />
    </>
  );
};

// ─── External IdP Card ────────────────────────────────────────────────────────
const ExternalIdPSecretCard = ({ item }: { item: SecretItem }) => {
  const pairs = item.keyValuePairs ?? {};
  const providerName = kv(pairs, "providerName", "ProviderName");
  const jwksUrl = kv(pairs, "jwksUrl", "JwksUrl");
  const certPath = kv(pairs, "publicCertificatePath", "PublicCertificatePath");
  const issuer = kv(pairs, "issuer", "Issuer");
  const audiences = kv(pairs, "audiences", "Audiences");
  const url = jwksUrl || certPath;
  const createdAt = item.createdDate ? format(new Date(item.createdDate), "dd/MM/yyyy HH:mm") : null;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{providerName || "External IdP"}</CardTitle>
          {createdAt && <p className="mt-0.5 text-xs text-muted-foreground">Created {createdAt}</p>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:gap-8">
          <div className="flex-1">
            <label className="mb-2 block text-sm text-low-emphasis">URL</label>
            <div className="break-all text-sm font-medium text-high-emphasis">{url || "-"}</div>
          </div>
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:gap-8">
          <div className="md:w-[30%]">
            <label className="mb-2 block text-sm text-low-emphasis">Issuer</label>
            <div className="break-all text-sm font-medium text-high-emphasis">{issuer || "-"}</div>
          </div>
          <div className="flex-1">
            <label className="mb-2 block text-sm text-low-emphasis">Audience</label>
            <div className="break-all text-sm font-medium text-high-emphasis">{audiences || "-"}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── SSO Card ─────────────────────────────────────────────────────────────────
const SSOSecretCard = ({ item }: { item: SecretItem }) => {
  const pairs = item.keyValuePairs ?? {};
  const clientId = kv(pairs, "clientId", "ClientId");
  const clientSecret = kv(pairs, "clientSecret", "ClientSecret");
  const redirectUrl = kv(pairs, "redirectUrl", "RedirectUrl");
  const audience = kv(pairs, "audience", "Audience");
  const wellKnownUrl = kv(pairs, "wellKnownUrl", "WellKnownUrl");
  const createdAt = item.createdDate ? format(new Date(item.createdDate), "dd/MM/yyyy HH:mm") : null;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>
            <CopyToClipboardButton textToCopy={clientId}>
              <MaskedText text={clientId} length={20} showFirstN={4} showLastN={4} />
            </CopyToClipboardButton>
          </CardTitle>
          {createdAt && <p className="mt-0.5 text-xs text-muted-foreground">Created {createdAt}</p>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Item label="Client ID">
            <CopyToClipboardButton textToCopy={clientId}>
              <MaskedText text={clientId} length={30} showFirstN={4} showLastN={4} />
            </CopyToClipboardButton>
          </Item>
          <Item label="Client Secret">
            <CopyToClipboardButton textToCopy={clientSecret}>
              <MaskedText text={clientSecret} length={30} showFirstN={4} showLastN={4} />
            </CopyToClipboardButton>
          </Item>
          <Item label="Redirect URL">
            <CopyToClipboardButton textToCopy={redirectUrl}>
              <span className="break-all">{redirectUrl || "N/A"}</span>
            </CopyToClipboardButton>
          </Item>
          <Item label="Audience">
            <CopyToClipboardButton textToCopy={audience}>
              <span className="break-all">{audience || "N/A"}</span>
            </CopyToClipboardButton>
          </Item>
          <div className="md:col-span-2">
            <Item label="Well Known URL">
              <CopyToClipboardButton textToCopy={wellKnownUrl}>
                <span className="break-all">{wellKnownUrl || "N/A"}</span>
              </CopyToClipboardButton>
            </Item>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Card Dispatcher ──────────────────────────────────────────────────────────
const SecretCard = ({ item }: { item: SecretItem }) => {
  switch (item.secretKey.toLowerCase()) {
    case SecretType.OIDC.toLowerCase(): return <OIDCSecretCard item={item} />;
    case SecretType.Captcha.toLowerCase(): return <CaptchaSecretCard item={item} />;
    case SecretType.ExternalIdP.toLowerCase(): return <ExternalIdPSecretCard item={item} />;
    case SecretType.SSO.toLowerCase(): return <SSOSecretCard item={item} />;
    default: return null;
  }
};

// ─── Per-Type List ────────────────────────────────────────────────────────────
function SecretTypeList({ secretKey, label }: { secretKey: string; label: string }) {
  const { data, isLoading } = useGetSecrets(secretKey);

  if (isLoading) return <LoadingSkeleton />;
  if (!data?.length) return <EmptyState label={label} />;

  return (
    <div className="grid gap-4">
      {data.map((item) => (
        <SecretCard key={item.itemId} item={item} />
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function SecretsList({ onTypeChange }: { onTypeChange?: (type: SecretType) => void }) {
  const [activeType, setActiveType] = useQueryState("secretType", {
    defaultValue: SecretType.OIDC,
    parse: (v) => (Object.values(SecretType).includes(v as SecretType) ? (v as SecretType) : SecretType.OIDC),
  });

  const handleChange = (v: string) => {
    void setActiveType(v as SecretType);
    onTypeChange?.(v as SecretType);
  };

  return (
    <Tabs value={activeType} onValueChange={handleChange} className="flex flex-col min-h-0">
      {/* Dropdown for small screens */}
      <div className="mb-4 block md:hidden">
        <Select value={activeType} onValueChange={handleChange}>
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

      {/* TabsList for larger screens */}
      <TabsList className="mb-4 w-fit bg-slate-200 border-b border-border shrink-0 hidden md:flex">
        {SECRET_TYPE_OPTIONS.map((opt) => (
          <TabsTrigger key={opt.value} value={opt.value}>
            {opt.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <div className="flex-1 overflow-y-auto">
        {SECRET_TYPE_OPTIONS.map((opt) => (
          <TabsContent key={opt.value} value={opt.value}>
            <SecretTypeList secretKey={opt.value} label={opt.label} />
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}

