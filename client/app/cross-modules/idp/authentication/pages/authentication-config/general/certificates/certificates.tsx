import { useState } from "react";
import { parseAsBoolean, parseAsString, useQueryState } from "nuqs";
import { Banner } from "@/components/ui-kits/banner/banner";
import { Button } from "@/components/ui-kits/button/button";
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
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { useGetProject } from "@/hooks/use-project";
import { useProjectStore } from "@seliseblocks/genesis-os";
import {
  useDeleteThirdPartyJwtProvider,
  useGetThirdPartyJwtProviders,
  useSaveThirdPartyJwtProvider,
  useUpdateThirdPartyJwtEnabled,
} from "@blocks-idp/authentication/hooks/use-third-party-jwt-provider";
import {
  requiresIdpHeader,
  toSavePayload,
  type ThirdPartyJwtProvider,
} from "@/cross-modules/identifier/models/third-party-jwt-provider.model";
import { ExternalIdpGallery } from "./external-idp-gallery";
import { MapJwtClaimModal } from "./map-jwt-claim-modal";
import { ProviderDetails } from "./provider-details";
import { ProviderFormModal } from "./provider-form-modal";

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
  const disabled = isLoading || isError || (!checked && !canEnable);
  const helper =
    !isLoading && !isError && !checked && !canEnable
      ? "Add an active provider to enable third-party token trust."
      : null;

  if (isError) {
    return (
      <div
        className="flex flex-col gap-1 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2"
        role="alert"
      >
        <p className="text-sm font-medium text-destructive">
          Could not load third-party token trust state
        </p>
        <p className="text-xs text-muted-foreground">
          The provider list below is unaffected. Reload the page to try again.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="space-y-0.5">
        <Label htmlFor="external-idp-trust" className="text-sm font-medium">
          Accept tokens from external identity providers
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
        aria-label="Accept tokens from external identity providers"
        onCheckedChange={(next) => {
          if (disabled || isPending) return;
          onToggle(next);
        }}
      />
    </div>
  );
}

export const Certificates = () => {
  const projectKey = useProjectStore().selectedProject?.tenantId ?? "";
  const {
    data: projectResponse,
    isLoading: isProjectLoading,
    isError: isProjectError,
  } = useGetProject();
  const { data: providers, isLoading: isProvidersLoading } =
    useGetThirdPartyJwtProviders(projectKey);
  const { mutateAsync: deleteProvider } = useDeleteThirdPartyJwtProvider();
  const { mutateAsync: saveProvider, isPending: isTogglingActive } = useSaveThirdPartyJwtProvider();
  const { mutateAsync: updateTrust, isPending: isTrustPending } = useUpdateThirdPartyJwtEnabled();

  const [isFormOpen, setIsFormOpen] = useQueryState(
    "editExternalIdp",
    parseAsBoolean.withDefault(false),
  );
  const [editing, setEditing] = useState<ThirdPartyJwtProvider | null>(null);
  // The platform picked from a gallery card, pre-selected in the add form. Null when the form was
  // opened from the page header, which leaves the choice to the admin.
  const [presetProviderName, setPresetProviderName] = useState<string | null>(null);
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
        showErrorToast({ errors: result.errors ?? "Could not update third-party token trust" });
        return;
      }
      showSuccessToast({
        description: next
          ? "External identity provider trust enabled"
          : "External identity provider trust disabled",
      });
    } catch {
      showErrorToast({ errors: "Could not update third-party token trust" });
    } finally {
      setRequestedTrust(null);
    }
  };

  const openAdd = (providerName: string) => {
    setEditing(null);
    setPresetProviderName(providerName);
    void setIsFormOpen(true);
  };

  const openEdit = (provider: ThirdPartyJwtProvider) => {
    setEditing(provider);
    setPresetProviderName(null);
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
    // Named by provider, not key: the key comes back masked, so it read as "**** enabled".
    showSuccessToast({
      description: `${statusTarget.providerName} provider ${willEnable ? "enabled" : "disabled"}`,
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
    showSuccessToast({ description: `${provider.providerName} provider removed` });
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

  const ambiguous = list.filter((p) => p.isActive && requiresIdpHeader(p, list));
  const opened = openItemId ? list.find((p) => p.itemId === openItemId) : undefined;

  const modals = (
    <>
      <ProviderFormModal
        open={isFormOpen}
        onOpenChange={(open) => {
          void setIsFormOpen(open);
          if (!open) {
            setEditing(null);
            setPresetProviderName(null);
          }
        }}
        existing={editing}
        presetProviderName={presetProviderName}
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
    <>
      <ExternalIdpGallery
        providers={list}
        isLoading={isProvidersLoading}
        trustToggle={trustToggle}
        notice={
          ambiguous.length > 0 && (
            <Banner variant="warning">
              {ambiguous.length} provider{ambiguous.length > 1 ? "s" : ""} share an issuer and
              audience with another, so callers must send{" "}
              <code className="font-mono">x-blocks-idp</code> to reach them. Giving them different
              audiences removes that requirement.
            </Banner>
          )
        }
        onAdd={openAdd}
        onToggleActive={setStatusTarget}
        isTogglingActive={isTogglingActive}
        onOpen={openDetails}
        onEdit={openEdit}
        onMapClaims={openClaimMapping}
        onDelete={remove}
      />
      {modals}
    </>
  );
};
