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

/** What the admin picked from the gallery - always a blank add for that provider type. */
type GalleryPick = { providerType: string; provider?: string };

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

  const socialEntries = (provider: "google" | "microsoft") =>
    providers.filter((p) => p.providerType === "social" && p.provider === provider);
  const googleEntries = socialEntries("google");
  const microsoftEntries = socialEntries("microsoft");
  const blocksOidcEntries = providers.filter((p) => p.providerType === "blocks-oidc");
  const byosEntries = providers.filter((p) => p.providerType === "byos");

  // Every provider type - social included - can hold more than one entry, so picking a
  // card always opens a blank add dialog; editing happens from the entry row itself.
  const handleSelectSocial = (provider: "google" | "microsoft") => {
    setGalleryPick({ providerType: "social", provider });
  };

  const handleSelectEnterprise = (providerType: "blocks-oidc" | "byos") => {
    setGalleryPick({ providerType });
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      setGalleryPick(null);
      onAddOpenChange(false);
    }
  };

  const dialogOpen = addOpen || galleryPick !== null;

  return (
    <div className="space-y-4">
      {isLoading ? (
        <GallerySkeleton />
      ) : isError ? (
        <LoadError onRetry={() => refetch()} />
      ) : (
        <IdentityProviderGallery
          googleEntries={googleEntries}
          microsoftEntries={microsoftEntries}
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
        presetProviderType={galleryPick?.providerType}
        presetProvider={galleryPick?.provider}
      />
    </div>
  );
}

export { IdentityProviderFormDialog };

export function IdentityProviderPage() {
  const [addOpen, setAddOpen] = useQueryState("addIdp", parseAsBoolean.withDefault(false));
  return <IdentityProviders addOpen={addOpen} onAddOpenChange={setAddOpen} />;
}
