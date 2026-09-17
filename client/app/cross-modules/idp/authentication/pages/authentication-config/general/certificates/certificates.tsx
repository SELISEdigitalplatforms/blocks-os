import { useState } from "react";
import { ChevronRight, Pencil, Plus, Power, PowerOff, Trash2, Waypoints } from "lucide-react";
import { parseAsBoolean, parseAsString, useQueryState } from "nuqs";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Banner } from "@/components/ui-kits/banner/banner";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui-kits/tooltip/tooltip";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { providers as providerCatalogue } from "@blocks-idp/authentication/constants/authentication.constant";
import {
  useDeleteThirdPartyJwtProvider,
  useGetThirdPartyJwtProviders,
  useSaveThirdPartyJwtProvider,
} from "@blocks-idp/authentication/hooks/use-third-party-jwt-provider";
import {
  requiresIdpHeader,
  SIGNING_ALGORITHMS,
  toSavePayload,
  type ThirdPartyJwtProvider,
  keySourceLabel,
} from "@/cross-modules/identifier/models/third-party-jwt-provider.model";
import { EmptyConfiguration } from "./empty-configuration";
import { MapJwtClaimModal } from "./map-jwt-claim-modal";
import { ProviderDetails } from "./provider-details";
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
  onToggleActive: (provider: ThirdPartyJwtProvider) => void;
  isTogglingActive: boolean;
  onOpen: (provider: ThirdPartyJwtProvider) => void;
  onEdit: (provider: ThirdPartyJwtProvider) => void;
  onMapClaims: (provider: ThirdPartyJwtProvider) => void;
  onDelete: (provider: ThirdPartyJwtProvider) => void;
};

function ProviderCard({
  provider,
  onToggleActive,
  isTogglingActive,
  onOpen,
  onEdit,
  onMapClaims,
  onDelete,
}: Readonly<ProviderCardProps>) {
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
              size="sm"
              variant="outline"
              className="h-8"
              aria-label={`Map JWT claim for ${provider.key}`}
              onClick={() => onMapClaims(provider)}
            >
              <Waypoints className="mr-2 h-4 w-4" />
              Map JWT claim
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              aria-label={`View details for ${provider.key}`}
              onClick={() => onOpen(provider)}
            >
              Details
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn(
                    "h-8 w-8",
                    provider.isActive
                      ? "text-emerald-600 hover:text-destructive"
                      : "text-muted-foreground hover:text-emerald-600",
                  )}
                  aria-label={
                    provider.isActive ? `Disable ${provider.key}` : `Enable ${provider.key}`
                  }
                  disabled={isTogglingActive}
                  onClick={() => onToggleActive(provider)}
                >
                  {provider.isActive ? (
                    <Power className="h-4 w-4" />
                  ) : (
                    <PowerOff className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{provider.isActive ? "Disable" : "Enable"}</TooltipContent>
            </Tooltip>
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
            value={
              provider.audiences?.length ? provider.audiences.join(", ") : "Any (validation off)"
            }
            muted={!provider.audiences?.length}
          />
          <Detail
            label="Algorithm"
            value={provider.algorithms?.map(algorithmLabel).join(", ") || "—"}
          />
          <Detail label="Key source" value={keySourceLabel(provider)} />
          <Detail label="User ID claim" value={provider.claimsMapping?.userId || "—"} />
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
  const { mutateAsync: saveProvider, isPending: isTogglingActive } = useSaveThirdPartyJwtProvider();

  const [isFormOpen, setIsFormOpen] = useQueryState(
    "editExternalIdp",
    parseAsBoolean.withDefault(false),
  );
  const [editing, setEditing] = useState<ThirdPartyJwtProvider | null>(null);
  const [mapping, setMapping] = useState<ThirdPartyJwtProvider | null>(null);
  const [statusTarget, setStatusTarget] = useState<ThirdPartyJwtProvider | null>(null);
  // A query parameter rather than a path segment: the surrounding layout resolves its heading and
  // active nav item from the last path segment, which an id would take over.
  const [openItemId, setOpenItemId] = useQueryState("provider", parseAsString);

  const list = providers ?? [];

  const openAdd = () => {
    setEditing(null);
    void setIsFormOpen(true);
  };

  const openEdit = (provider: ThirdPartyJwtProvider) => {
    setEditing(provider);
    void setIsFormOpen(true);
  };

  const openClaimMapping = (provider: ThirdPartyJwtProvider) => setMapping(provider);

  const openDetails = (provider: ThirdPartyJwtProvider) => void setOpenItemId(provider.itemId);

  // Disabling stops tokens being accepted without discarding the configuration, so it is asked
  // about rather than done on the first click — the same confirmation client credentials use.
  const confirmStatusChange = async () => {
    if (!statusTarget) return;

    const willEnable = !statusTarget.isActive;
    const result = await saveProvider(toSavePayload(statusTarget, { isActive: willEnable }));

    if (!result.isSuccess) {
      showErrorToast({
        errors:
          Object.values(result.errors ?? {}).join(" ") ||
          `Could not ${willEnable ? "enable" : "disable"} the provider`,
      });
      return;
    }

    setStatusTarget(null);
    showSuccessToast({
      description: `${statusTarget.key} ${willEnable ? "enabled" : "disabled"}`,
    });
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

    if (provider.itemId === openItemId) void setOpenItemId(null);
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
          projectKey={projectKey}
        />
      </>
    );
  }

  const ambiguous = list.filter((p) => p.isActive && requiresIdpHeader(p, list));
  const opened = openItemId ? list.find((p) => p.itemId === openItemId) : undefined;

  const modals = (
    <>
      <ProviderFormModal
        open={isFormOpen}
        onOpenChange={(open) => {
          void setIsFormOpen(open);
          if (!open) setEditing(null);
        }}
        existing={editing}
        projectKey={projectKey}
        siblingIssuers={list
          .filter((p) => p.isActive && p.itemId !== editing?.itemId)
          .map((p) => p.issuer)}
      />

      <MapJwtClaimModal
        open={!!mapping}
        onOpenChange={(open) => {
          if (!open) setMapping(null);
        }}
        provider={mapping && (list.find((p) => p.itemId === mapping.itemId) ?? mapping)}
      />

      <Dialog
        open={!!statusTarget}
        onOpenChange={(open) => {
          if (!open) setStatusTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {statusTarget?.isActive ? "Disable provider" : "Enable provider"}
            </DialogTitle>
            <DialogDescription>
              {statusTarget?.isActive ? (
                <>
                  Tokens from <strong>{statusTarget?.key}</strong> will no longer be accepted on
                  your APIs. Its configuration is kept, so you can enable it again at any time.
                </>
              ) : (
                <>
                  Tokens from <strong>{statusTarget?.key}</strong> will be accepted on your APIs
                  again.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatusTarget(null)}
              disabled={isTogglingActive}
            >
              Cancel
            </Button>
            <Button
              variant={statusTarget?.isActive ? "destructive" : "default"}
              size="sm"
              onClick={confirmStatusChange}
              disabled={isTogglingActive}
            >
              {statusTarget?.isActive ? "Disable" : "Enable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (opened) {
    return (
      <>
        <ProviderDetails
          provider={opened}
          allProviders={list}
          projectKey={projectKey}
          onBack={() => void setOpenItemId(null)}
          onEdit={openEdit}
          onMapClaims={openClaimMapping}
        />
        {modals}
      </>
    );
  }

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
        <ProviderCard
          key={provider.itemId}
          provider={provider}
          onToggleActive={setStatusTarget}
          isTogglingActive={isTogglingActive}
          onOpen={openDetails}
          onEdit={openEdit}
          onMapClaims={openClaimMapping}
          onDelete={remove}
        />
      ))}

      {modals}
    </div>
  );
};
