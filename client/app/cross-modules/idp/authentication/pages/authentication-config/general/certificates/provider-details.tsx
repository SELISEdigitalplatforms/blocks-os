import { ArrowLeft, Copy, Download, Pencil, Waypoints } from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { showSuccessToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { providers as providerCatalogue } from "@blocks-idp/authentication/constants/authentication.constant";
import {
  certificateExpiry,
  keySourceLabel,
  getSigningAlgorithms,
  type ThirdPartyJwtProvider,
} from "@/cross-modules/identifier/models/third-party-jwt-provider.model";
import { ApiIntegrationCard } from "./api-integration-card";
import { useT } from "@seliseblocks/genesis-os";

const algorithmLabel = (value: number) =>
  getSigningAlgorithms().find((a) => a.value === value)?.label ?? "—";

const providerIcon = (name: string) =>
  providerCatalogue.find((p) => p.name.toLowerCase() === name?.toLowerCase())?.icon;

function Detail({
  label,
  value,
  muted,
}: Readonly<{ label: string; value: string; muted?: boolean }>) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className={`break-all text-sm font-medium ${muted ? "text-muted-foreground" : ""}`}>
        {value}
      </div>
    </div>
  );
}

/**
 * Everything about the configured certificate that an operator acts on.
 *
 * Shown only here and not on the list card, because the useful parts are long: the storage URL,
 * the subject to match against what the provider sent, and the thumbprint to match against what
 * they published.
 *
 * The URL and the download are safe to surface. The certificate holds a public key, and the
 * container serves it anonymously by design — Genesis fetches it with a bare HTTP client and no
 * credentials — so the link exposes nothing that was not already reachable.
 */
function CertificatePanel({ provider }: Readonly<{ provider: ThirdPartyJwtProvider }>) {
  const { t } = useT("os.idp.auth");
  const expiry = certificateExpiry(provider);

  const copyUrl = async () => {
    await navigator.clipboard.writeText(provider.publicCertificatePath);
    showSuccessToast({ description: t("PROVIDER_DETAILS.CERTIFICATE_URL_COPIED") });
  };

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("PROVIDER_DETAILS.CERTIFICATE")}</h3>
        {expiry && (
          <Badge
            variant={expiry.expired || expiry.expiringSoon ? "destructive" : "secondary"}
            title={expiry.on.toISOString()}
          >
            {expiry.expired
              ? t("PROVIDER_DETAILS.EXPIRED_AGO", { count: Math.abs(expiry.daysLeft) })
              : t("PROVIDER_DETAILS.EXPIRES_IN", { count: expiry.daysLeft })}
          </Badge>
        )}
      </div>

      {/* A certificate pins one key, so a lapse refuses every token the provider issues and
          nothing in the token says why. Worth stating outright rather than leaving to the date. */}
      {expiry?.expired && (
        <p className="text-xs text-destructive">
          {t("PROVIDER_DETAILS.EXPIRED_WARNING")}
        </p>
      )}
      {expiry?.expiringSoon && (
        <p className="text-xs text-destructive">
          {t("PROVIDER_DETAILS.EXPIRING_WARNING")}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Detail
          label={t("PROVIDER_DETAILS.SUBJECT")}
          value={provider.certificateSubject || t("PROVIDER_DETAILS.NOT_READ")}
          muted={!provider.certificateSubject}
        />
        <Detail
          label={t("PROVIDER_DETAILS.EXPIRES")}
          value={expiry ? expiry.on.toLocaleDateString() : t("PROVIDER_DETAILS.NOT_READ")}
          muted={!expiry}
        />
        <div className="space-y-1 sm:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("PROVIDER_DETAILS.THUMBPRINT")}
          </p>
          <code className="block break-all font-mono text-xs">
            {provider.certificateThumbprint || "—"}
          </code>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("PROVIDER_DETAILS.STORED_AT")}
          </p>
          <code className="block break-all font-mono text-xs">
            {provider.publicCertificatePath}
          </code>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="h-8" onClick={() => void copyUrl()}>
          <Copy className="mr-2 h-4 w-4" />
          {t("PROVIDER_DETAILS.COPY_URL")}
        </Button>
        {/* download without a value lets the server name the file; rel is set because the
            certificate lives on a storage host rather than this origin. */}
        <Button size="sm" variant="outline" className="h-8" asChild>
          <a
            href={provider.publicCertificatePath}
            download
            target="_blank"
            rel="noreferrer noopener"
          >
            <Download className="mr-2 h-4 w-4" />
            {t("common:DOWNLOAD")}
          </a>
        </Button>
      </div>

      {!provider.certificateSubject && (
        <p className="text-xs text-muted-foreground">
          {t("PROVIDER_DETAILS.UNREADABLE")}
        </p>
      )}
    </div>
  );
}

type ProviderDetailsProps = {
  provider: ThirdPartyJwtProvider;
  allProviders: ThirdPartyJwtProvider[];
  projectKey: string;
  onBack: () => void;
  onEdit: (provider: ThirdPartyJwtProvider) => void;
  onMapClaims: (provider: ThirdPartyJwtProvider) => void;
};

/**
 * Everything about one provider on a page of its own: what it validates, how a token maps onto a
 * Blocks user, and what a caller has to send. The list stays a list, which is what makes several
 * providers readable at a glance.
 */
export function ProviderDetails({
  provider,
  allProviders,
  projectKey,
  onBack,
  onEdit,
  onMapClaims,
}: Readonly<ProviderDetailsProps>) {
  const { t } = useT("os.idp.auth");
  const icon = providerIcon(provider.providerName);
  const mapping = provider.claimsMapping;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2 h-8" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("PROVIDER_DETAILS.ALL_PROVIDERS")}
      </Button>

      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              {icon ? (
                <img src={icon} alt="" width={20} height={20} className="h-5 w-5 object-contain" />
              ) : (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600">
                  <div className="h-2 w-2 rounded-full bg-white" />
                </div>
              )}
              <span className="text-base font-semibold">{provider.providerName}</span>
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                {provider.key}
              </code>
              <Badge variant={provider.isActive ? "secondary" : "outline"}>
                {provider.isActive ? t("PROVIDER_DETAILS.ACTIVE") : t("PROVIDER_DETAILS.INACTIVE")}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => onMapClaims(provider)}
              >
                <Waypoints className="mr-2 h-4 w-4" />
                {t("PROVIDER_DETAILS.MAP_JWT_CLAIM")}
              </Button>
              <Button size="sm" className="h-8" onClick={() => onEdit(provider)}>
                <Pencil className="mr-2 h-4 w-4" />
                {t("common:EDIT")}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Detail label={t("PROVIDER_DETAILS.ISSUER")} value={provider.issuer} />
            <Detail
              label={t("PROVIDER_DETAILS.AUDIENCE")}
              value={
                provider.audiences?.length
                  ? provider.audiences.join(", ")
                  : t("PROVIDER_DETAILS.AUDIENCE_ANY")
              }
              muted={!provider.audiences?.length}
            />
            <Detail
              label={t("PROVIDER_DETAILS.ALGORITHM")}
              value={provider.algorithms?.map(algorithmLabel).join(", ") || "—"}
            />
            <Detail label={t("PROVIDER_DETAILS.KEY_SOURCE")} value={keySourceLabel(provider)} />
            {provider.cookieKey && <Detail label={t("PROVIDER_DETAILS.COOKIE_KEY")} value={provider.cookieKey} />}
          </div>

          {provider.publicCertificatePath && <CertificatePanel provider={provider} />}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <h3 className="text-sm font-semibold">{t("PROVIDER_DETAILS.CLAIM_MAPPING")}</h3>
            <p className="text-xs text-muted-foreground">
              {t("PROVIDER_DETAILS.CLAIM_MAPPING_HINT")}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Detail label={t("PROVIDER_DETAILS.USER_ID")} value={mapping?.userId || "—"} muted={!mapping?.userId} />
            <Detail
              label={t("common:EMAIL")}
              value={mapping?.email || t("PROVIDER_DETAILS.NOT_MAPPED")} muted={!mapping?.email} />
            <Detail
              label={t("PROVIDER_DETAILS.USERNAME")}
              value={mapping?.userName || t("PROVIDER_DETAILS.NOT_MAPPED")}
              muted={!mapping?.userName}
            />
            <Detail
              label={t("PROVIDER_DETAILS.DISPLAY_NAME")}
              value={mapping?.name || t("PROVIDER_DETAILS.NOT_MAPPED")}
              muted={!mapping?.name}
            />
            <Detail
              label={t("PROVIDER_DETAILS.ROLES")}
              value={mapping?.roles || t("PROVIDER_DETAILS.NOT_MAPPED")}
              muted={!mapping?.roles}
            />
          </div>
        </CardContent>
      </Card>

      <ApiIntegrationCard provider={provider} allProviders={allProviders} projectKey={projectKey} />
    </div>
  );
}
