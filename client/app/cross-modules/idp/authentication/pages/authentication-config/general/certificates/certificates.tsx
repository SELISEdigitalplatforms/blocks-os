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
import { Label } from "@/components/ui-kits/label/label";
import { Switch } from "@/components/ui-kits/switch/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui-kits/tooltip/tooltip";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { useGetProject } from "@/hooks/use-project";
import { useProjectStore, useT } from "@seliseblocks/genesis-os";
import { providers as providerCatalogue } from "@blocks-idp/authentication/constants/authentication.constant";
import {
  useDeleteThirdPartyJwtProvider,
  useGetThirdPartyJwtProviders,
  useSaveThirdPartyJwtProvider,
  useUpdateThirdPartyJwtEnabled,
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
  const { t } = useT("os.idp.auth");
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
            {!provider.isActive && <Badge variant="secondary">{t("CERTIFICATES.INACTIVE")}</Badge>}
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              aria-label={t("CERTIFICATES.MAP_JWT_CLAIM_FOR", { key: provider.key })}
              onClick={() => onMapClaims(provider)}
            >
              <Waypoints className="mr-2 h-4 w-4" />
              {t("CERTIFICATES.MAP_JWT_CLAIM")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              aria-label={t("CERTIFICATES.VIEW_DETAILS_FOR", { key: provider.key })}
              onClick={() => onOpen(provider)}
            >
              {t("common:DETAILS")}
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
                    provider.isActive
                      ? t("CERTIFICATES.DISABLE_KEY", { key: provider.key })
                      : t("CERTIFICATES.ENABLE_KEY", { key: provider.key })
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
              <TooltipContent>
                {provider.isActive ? t("CERTIFICATES.DISABLE") : t("CERTIFICATES.ENABLE")}
              </TooltipContent>
            </Tooltip>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              aria-label={t("CERTIFICATES.EDIT_KEY", { key: provider.key })}
              onClick={() => onEdit(provider)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              aria-label={t("CERTIFICATES.DELETE_KEY", { key: provider.key })}
              onClick={() => onDelete(provider)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Detail label={t("CERTIFICATES.ISSUER")} value={provider.issuer} />
          <Detail
            label={t("CERTIFICATES.AUDIENCE")}
            value={
              provider.audiences?.length
                ? provider.audiences.join(", ")
                : t("CERTIFICATES.AUDIENCE_ANY")
            }
            muted={!provider.audiences?.length}
          />
          <Detail
            label={t("CERTIFICATES.ALGORITHM")}
            value={provider.algorithms?.map(algorithmLabel).join(", ") || "—"}
          />
          <Detail label={t("CERTIFICATES.KEY_SOURCE")} value={keySourceLabel(provider)} />
          <Detail label={t("CERTIFICATES.USER_ID_CLAIM")} value={provider.claimsMapping?.userId || "—"} />
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

type TrustToggleProps = {
  checked: boolean;
  canEnable: boolean;
  isLoading: boolean;
  isError: boolean;
  isPending: boolean;
  onToggle: (next: boolean) => void;
};

/**
 * Tenant-scoped trust switch. Stays disabled when enable would be rejected (no active provider).
 * While a change is saving it shows the requested position and ignores further clicks rather than
 * greying out, so the thumb neither vanishes nor jumps back; a refused change returns it to the
 * stored value.
 */
function TrustToggle({
  checked,
  canEnable,
  isLoading,
  isError,
  isPending,
  onToggle,
}: Readonly<TrustToggleProps>) {
  const { t } = useT("os.idp.auth");
  const disabled = isLoading || isError || (!checked && !canEnable);
  const helper =
    !isLoading && !isError && !checked && !canEnable
      ? t("CERTIFICATES.TRUST_NEEDS_PROVIDER")
      : null;

  if (isError) {
    return (
      <div
        className="flex flex-col gap-1 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2"
        role="alert"
      >
        <p className="text-sm font-medium text-destructive">
          {t("CERTIFICATES.TRUST_LOAD_ERROR_TITLE")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("CERTIFICATES.TRUST_LOAD_ERROR_MESSAGE")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="space-y-0.5">
        <Label htmlFor="external-idp-trust" className="text-sm font-medium">
          {t("CERTIFICATES.TRUST_LABEL")}
        </Label>
        {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
        {isLoading ? <Skeleton className="h-3 w-48" /> : null}
      </div>
      <Switch
        id="external-idp-trust"
        size="sm"
        checked={checked}
        disabled={disabled}
        aria-busy={isPending || undefined}
        aria-label={t("CERTIFICATES.TRUST_LABEL")}
        onCheckedChange={(next) => {
          if (disabled || isPending) return;
          onToggle(next);
        }}
      />
    </div>
  );
}

export const Certificates = () => {
  const { t } = useT("os.idp.auth");
  const projectKey = useProjectStore().selectedProject?.tenantId ?? "";
  const {
    data: projectResponse,
    isLoading: isProjectLoading,
    isError: isProjectError,
  } = useGetProject();
  const {
    data: providers,
    isLoading: isProvidersLoading,
  } = useGetThirdPartyJwtProviders(projectKey);
  const { mutateAsync: deleteProvider } = useDeleteThirdPartyJwtProvider();
  const { mutateAsync: saveProvider, isPending: isTogglingActive } = useSaveThirdPartyJwtProvider();
  const { mutateAsync: updateTrust, isPending: isTrustPending } = useUpdateThirdPartyJwtEnabled();

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
  // The position the user asked for, held only until the save and the project refetch behind it
  // settle; the switch then reads the stored value again.
  const [requestedTrust, setRequestedTrust] = useState<boolean | null>(null);

  const list = providers ?? [];
  const trustEnabled = requestedTrust ?? projectResponse?.data?.isThirdPartyJwtEnabled === true;
  const activeProviderCount = list.filter((p) => p.isActive).length;
  const canEnable = activeProviderCount > 0;

  const toggleTrust = async (next: boolean) => {
    setRequestedTrust(next);
    try {
      const result = await updateTrust(next);
      if (!result.isSuccess) {
        showErrorToast({ errors: result.errors ?? t("CERTIFICATES.TRUST_UPDATE_FAILED") });
        return;
      }
      showSuccessToast({
        description: next ? t("CERTIFICATES.TRUST_ENABLED") : t("CERTIFICATES.TRUST_DISABLED"),
      });
    } catch {
      showErrorToast({ errors: t("CERTIFICATES.TRUST_UPDATE_FAILED") });
    } finally {
      setRequestedTrust(null);
    }
  };

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
          (willEnable ? t("CERTIFICATES.ENABLE_FAILED") : t("CERTIFICATES.DISABLE_FAILED")),
      });
      return;
    }

    setStatusTarget(null);
    // Named by provider, not key: the key comes back masked, so it read as "**** enabled".
    showSuccessToast({
      description: willEnable
        ? t("CERTIFICATES.PROVIDER_ENABLED", { name: statusTarget.providerName })
        : t("CERTIFICATES.PROVIDER_DISABLED", { name: statusTarget.providerName }),
    });
  };

  const remove = async (provider: ThirdPartyJwtProvider) => {
    // Deleting the row is what revokes the credential: the encrypted secret lives on it, so
    // nothing is left behind elsewhere.
    const result = await deleteProvider(provider.itemId);

    if (!result.isSuccess) {
      showErrorToast({
        errors: Object.values(result.errors ?? {}).join(" ") || t("CERTIFICATES.DELETE_FAILED"),
      });
      return;
    }

    if (provider.itemId === openItemId) void setOpenItemId(null);
    showSuccessToast({ description: t("CERTIFICATES.PROVIDER_REMOVED", { name: provider.providerName }) });
  };

  const trustToggle = (
    <TrustToggle
      checked={trustEnabled}
      canEnable={canEnable}
      isLoading={isProjectLoading || isProvidersLoading}
      isError={isProjectError}
      isPending={isTrustPending}
      onToggle={(next) => {
        void toggleTrust(next);
      }}
    />
  );

  if (isProvidersLoading) {
    return (
      <div className="space-y-4">
        {trustToggle}
        <LoadingSkeleton />
      </div>
    );
  }

  if (!list.length) {
    return (
      <div className="space-y-4">
        {trustToggle}
        <EmptyConfiguration onAdd={openAdd} />
        <ProviderFormModal
          open={isFormOpen}
          onOpenChange={(open) => void setIsFormOpen(open)}
          existing={null}
          projectKey={projectKey}
        />
      </div>
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
              {statusTarget?.isActive ? t("CERTIFICATES.DISABLE_PROVIDER") : t("CERTIFICATES.ENABLE_PROVIDER")}
            </DialogTitle>
            <DialogDescription>
              {statusTarget?.isActive
                ? t("CERTIFICATES.DISABLE_DESCRIPTION", { key: statusTarget?.key ?? "" })
                : t("CERTIFICATES.ENABLE_DESCRIPTION", { key: statusTarget?.key ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatusTarget(null)}
              disabled={isTogglingActive}
            >
              {t("common:CANCEL")}
            </Button>
            <Button
              variant={statusTarget?.isActive ? "destructive" : "default"}
              size="sm"
              onClick={confirmStatusChange}
              disabled={isTogglingActive}
            >
              {statusTarget?.isActive ? t("CERTIFICATES.DISABLE") : t("CERTIFICATES.ENABLE")}
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
      {trustToggle}

      {ambiguous.length > 0 && (
        <Banner variant="warning">
          {t("CERTIFICATES.AMBIGUOUS", { count: ambiguous.length, header: "x-blocks-idp" })}
        </Banner>
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          {t("CERTIFICATES.ADD_PROVIDER")}
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
