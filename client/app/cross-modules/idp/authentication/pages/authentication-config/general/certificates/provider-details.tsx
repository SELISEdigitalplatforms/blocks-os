import { ArrowLeft, Pencil, Waypoints } from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { providers as providerCatalogue } from "@blocks-idp/authentication/constants/authentication.constant";
import {
  SIGNING_ALGORITHMS,
  type ThirdPartyJwtProvider,
} from "@/cross-modules/identifier/models/third-party-jwt-provider.model";
import { ApiIntegrationCard } from "./api-integration-card";

const algorithmLabel = (value: number) =>
  SIGNING_ALGORITHMS.find((a) => a.value === value)?.label ?? "—";

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
  const icon = providerIcon(provider.providerName);
  const mapping = provider.claimsMapping;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2 h-8" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        All providers
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
                {provider.isActive ? "Active" : "Inactive"}
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
                Map JWT claim
              </Button>
              <Button size="sm" className="h-8" onClick={() => onEdit(provider)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Detail label="Issuer" value={provider.issuer} />
            <Detail
              label="Audience"
              value={
                provider.audiences?.length
                  ? provider.audiences.join(", ")
                  : "Any (validation off)"
              }
              muted={!provider.audiences?.length}
            />
            <Detail
              label="Algorithm"
              value={provider.algorithms?.map(algorithmLabel).join(", ") || "—"}
            />
            <Detail
              label="Key source"
              value={
                provider.hasSigningSecret
                  ? "Shared secret (stored encrypted)"
                  : provider.jwksUrl || "—"
              }
            />
            {provider.cookieKey && <Detail label="Cookie key" value={provider.cookieKey} />}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <h3 className="text-sm font-semibold">Claim mapping</h3>
            <p className="text-xs text-muted-foreground">
              Which claim of an incoming token supplies each field of the Blocks user.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Detail label="User ID" value={mapping?.userId || "—"} muted={!mapping?.userId} />
            <Detail label="Email" value={mapping?.email || "Not mapped"} muted={!mapping?.email} />
            <Detail
              label="Username"
              value={mapping?.userName || "Not mapped"}
              muted={!mapping?.userName}
            />
            <Detail
              label="Display name"
              value={mapping?.name || "Not mapped"}
              muted={!mapping?.name}
            />
            <Detail label="Roles" value={mapping?.roles || "Not mapped"} muted={!mapping?.roles} />
          </div>
        </CardContent>
      </Card>

      <ApiIntegrationCard
        provider={provider}
        allProviders={allProviders}
        projectKey={projectKey}
      />
    </div>
  );
}
