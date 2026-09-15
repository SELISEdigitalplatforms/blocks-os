import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { parseAsBoolean, useQueryState } from "nuqs";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Banner } from "@/components/ui-kits/banner/banner";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { providers as providerCatalogue } from "@blocks-idp/authentication/constants/authentication.constant";
import {
  useDeleteThirdPartyJwtProvider,
  useGetThirdPartyJwtProviders,
} from "@blocks-idp/authentication/hooks/use-third-party-jwt-provider";
import {
  requiresIdpHeader,
  SIGNING_ALGORITHMS,
  type ThirdPartyJwtProvider,
} from "@/cross-modules/identifier/models/third-party-jwt-provider.model";
import { ApiIntegrationCard } from "./api-integration-card";
import { EmptyConfiguration } from "./empty-configuration";
import { ProviderFormModal } from "./provider-form-modal";

const LoadingSkeleton = () => (
  <Card>
    <CardContent className="space-y-3 pt-4">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} className="flex flex-col gap-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-64" />
        </div>
      ))}
    </CardContent>
  </Card>
);

const algorithmLabel = (value: number) =>
  SIGNING_ALGORITHMS.find((a) => a.value === value)?.label ?? "—";

const providerIcon = (name: string) =>
  providerCatalogue.find((p) => p.name.toLowerCase() === name?.toLowerCase())?.icon;

type ProviderCardProps = {
  provider: ThirdPartyJwtProvider;
  onEdit: (provider: ThirdPartyJwtProvider) => void;
  onDelete: (provider: ThirdPartyJwtProvider) => void;
};

function ProviderCard({ provider, onEdit, onDelete }: Readonly<ProviderCardProps>) {
  const icon = providerIcon(provider.providerName);

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {icon ? (
              <img src={icon} alt="" width={16} height={16} className="h-4 w-4 object-contain" />
            ) : (
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600">
                <div className="h-2 w-2 rounded-full bg-white" />
              </div>
            )}
            <span className="text-sm font-semibold">{provider.providerName}</span>
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{provider.key}</code>
            {!provider.isActive && <Badge variant="secondary">Inactive</Badge>}
          </div>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              aria-label={`Edit ${provider.key}`}
              onClick={() => onEdit(provider)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              aria-label={`Delete ${provider.key}`}
              onClick={() => onDelete(provider)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Detail label="Issuer" value={provider.issuer} />
          <Detail
            label="Audience"
            value={provider.audiences?.length ? provider.audiences.join(", ") : "Any (validation off)"}
            muted={!provider.audiences?.length}
          />
          <Detail
            label="Algorithm"
            value={provider.algorithms?.map(algorithmLabel).join(", ") || "—"}
          />
          <Detail
            label="Key source"
            value={provider.hasSigningSecret ? "Shared secret (stored encrypted)" : provider.jwksUrl || "—"}
          />
        </div>
      </CardContent>
    </Card>
  );
}

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

export const Certificates = () => {
  const projectKey = useProjectStore().selectedProject?.tenantId ?? "";
  const { data: providers, isLoading } = useGetThirdPartyJwtProviders(projectKey);
  const { mutateAsync: deleteProvider } = useDeleteThirdPartyJwtProvider();

  const [isFormOpen, setIsFormOpen] = useQueryState(
    "editExternalIdp",
    parseAsBoolean.withDefault(false),
  );
  const [editing, setEditing] = useState<ThirdPartyJwtProvider | null>(null);

  const list = providers ?? [];

  const openAdd = () => {
    setEditing(null);
    void setIsFormOpen(true);
  };

  const openEdit = (provider: ThirdPartyJwtProvider) => {
    setEditing(provider);
    void setIsFormOpen(true);
  };

  const remove = async (provider: ThirdPartyJwtProvider) => {
    // Deleting the row is what revokes the credential: the encrypted secret lives on it, so
    // nothing is left behind elsewhere.
    const result = await deleteProvider(provider.itemId);

    if (!result.isSuccess) {
      showErrorToast({
        errors: Object.values(result.errors ?? {}).join(" ") || "Could not delete the provider",
      });
      return;
    }

    showSuccessToast({ description: `Removed ${provider.key}` });
  };

  if (isLoading) return <LoadingSkeleton />;

  if (!list.length) {
    return (
      <>
        <EmptyConfiguration onAdd={openAdd} />
        <ProviderFormModal
          open={isFormOpen}
          onOpenChange={(open) => void setIsFormOpen(open)}
          existing={null}
        />
      </>
    );
  }

  const ambiguous = list.filter((p) => p.isActive && requiresIdpHeader(p, list));

  return (
    <div className="space-y-4">
      {ambiguous.length > 0 && (
        <Banner variant="warning">
          {ambiguous.length} provider{ambiguous.length > 1 ? "s" : ""} share an issuer and audience
          with another, so callers must send <code className="font-mono">x-blocks-idp</code> to
          reach them. Giving them different audiences removes that requirement.
        </Banner>
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add provider
        </Button>
      </div>

      {list.map((provider) => (
        <div key={provider.itemId} className="space-y-3">
          <ProviderCard provider={provider} onEdit={openEdit} onDelete={remove} />
          <ApiIntegrationCard provider={provider} allProviders={list} />
        </div>
      ))}

      <ProviderFormModal
        open={isFormOpen}
        onOpenChange={(open) => {
          void setIsFormOpen(open);
          if (!open) setEditing(null);
        }}
        existing={editing}
        siblingIssuers={list
          .filter((p) => p.isActive && p.itemId !== editing?.itemId)
          .map((p) => p.issuer)}
      />
    </div>
  );
};
