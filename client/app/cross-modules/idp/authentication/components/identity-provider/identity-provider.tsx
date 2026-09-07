import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { parseAsBoolean, useQueryState } from "nuqs";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { IdentityProvider } from "@blocks-idp/authentication/models/identity-provider.model";
import { useGetIdentityProviders } from "@blocks-idp/authentication/hooks/use-identity-provider";
import { IdentityProviderFormDialog } from "./identity-provider-form-dialog";
import { GallerySkeleton, IdentityProviderGallery } from "./identity-provider-gallery";

type Props = {
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
};

type GalleryPick =
  { kind: "add"; providerType: string; provider?: string } | { kind: "edit"; editId: string };

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-7 w-7 text-destructive" />
        </div>
        <div>
          <p className="text-base font-medium text-high-emphasis">
            Couldn&apos;t load identity providers
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Something went wrong while fetching your identity providers.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

export function IdentityProviders({ addOpen, onAddOpenChange }: Props) {
  const projectId = useProjectStore().selectedProject?.itemId || "";
  const { data, isLoading, isError, refetch } = useGetIdentityProviders({ projectId });
  const providers: IdentityProvider[] = data?.data ?? [];

  const [galleryPick, setGalleryPick] = useState<GalleryPick | null>(null);

  const googleEntry = providers.find((p) => p.providerType === "social" && p.provider === "google");
  const microsoftEntry = providers.find(
    (p) => p.providerType === "social" && p.provider === "microsoft",
  );
  const blocksOidcEntries = providers.filter((p) => p.providerType === "blocks-oidc");
  const byosEntries = providers.filter((p) => p.providerType === "byos");
  const isGoogleConfigured = !!googleEntry;
  const isMicrosoftConfigured = !!microsoftEntry;

  const handleSelectSocial = (provider: "google" | "microsoft") => {
    const entry = provider === "google" ? googleEntry : microsoftEntry;
    setGalleryPick(
      entry
        ? { kind: "edit", editId: entry.itemId! }
        : { kind: "add", providerType: "social", provider },
    );
  };

  const handleSelectEnterprise = (providerType: "blocks-oidc" | "byos") => {
    setGalleryPick({ kind: "add", providerType });
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      setGalleryPick(null);
      onAddOpenChange(false);
    }
  };

  const dialogOpen = addOpen || galleryPick !== null;
  const editId = galleryPick?.kind === "edit" ? galleryPick.editId : undefined;
  const presetProviderType = galleryPick?.kind === "add" ? galleryPick.providerType : undefined;
  const presetProvider = galleryPick?.kind === "add" ? galleryPick.provider : undefined;

  return (
    <div className="space-y-4">
      {isLoading ? (
        <GallerySkeleton />
      ) : isError ? (
        <LoadError onRetry={() => refetch()} />
      ) : (
        <IdentityProviderGallery
          googleEntry={googleEntry}
          microsoftEntry={microsoftEntry}
          blocksOidcEntries={blocksOidcEntries}
          byosEntries={byosEntries}
          onSelectGoogle={() => handleSelectSocial("google")}
          onSelectMicrosoft={() => handleSelectSocial("microsoft")}
          onSelectBlocksOidc={() => handleSelectEnterprise("blocks-oidc")}
          onSelectByos={() => handleSelectEnterprise("byos")}
        />
      )}

      <IdentityProviderFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        editId={editId}
        presetProviderType={presetProviderType}
        presetProvider={presetProvider}
        isGoogleConfigured={isGoogleConfigured}
        isMicrosoftConfigured={isMicrosoftConfigured}
      />
    </div>
  );
}

export { IdentityProviderFormDialog };

export function IdentityProviderPage() {
  const [addOpen, setAddOpen] = useQueryState("addIdp", parseAsBoolean.withDefault(false));
  return <IdentityProviders addOpen={addOpen} onAddOpenChange={setAddOpen} />;
}
