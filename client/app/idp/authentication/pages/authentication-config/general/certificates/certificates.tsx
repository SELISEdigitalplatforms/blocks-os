import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Banner } from "@/components/ui-kits/banner/banner";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import { useGetSavedPublicCertificates } from "@blocks-idp/authentication/hooks/use-identifier";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { EmptyConfiguration } from "./empty-configuration";
import { AddEditProviderModal } from "./add-edit-provider-modal";
import { providers } from "@blocks-idp/authentication/constants/authentication.constant";
import MapJwtClaimModal from "./map-jwt-claim-modal";
import { useGetJwtClaim } from "@blocks-idp/authentication/hooks/use-jwt-claim";
import { parseAsBoolean, useQueryState } from "nuqs";

const LoadingSkelton = () => {
  return (
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
};

export const Certificates = () => {
  const projectKey = useProjectStore().selectedProject?.tenantId ?? "";
  const { isLoading, data: existingCertificate } = useGetSavedPublicCertificates(projectKey);
  const { data: jwtClaimData, isLoading: isJwtClaimLoading } = useGetJwtClaim(
    { projectKey, itemId: "" },
    !!projectKey && !!existingCertificate?.isConfigured,
  );
  const [isJwtClaimModalOpen, setIsJwtClaimModalOpen] = useQueryState(
    "jwtClaim",
    parseAsBoolean.withDefault(false),
  );
  const [isEditModalOpen, setIsEditModalOpen] = useQueryState(
    "editExternalIdp",
    parseAsBoolean.withDefault(false),
  );
  const openJwtClaimModal = () => void setIsJwtClaimModalOpen(true);
  const hasJwtClaimData = !!jwtClaimData?.itemId;
  if (isLoading) {
    return <LoadingSkelton />;
  }
  if (!existingCertificate?.isConfigured) {
    return <EmptyConfiguration />;
  }
  return (
    <>
      {!isLoading && !isJwtClaimLoading && !hasJwtClaimData && (
        <Banner variant="warning">
          You didn&apos;t map the jwt claims. To ignore 401(Unauthorized) in api request please{" "}
          <button
            type="button"
            onClick={openJwtClaimModal}
            className="font-semibold underline"
          >
            Map JWT Claims
          </button>
          .
        </Banner>
      )}
      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Provider</p>
              <div className="flex items-center gap-2 text-sm font-medium">
                {(() => {
                  const provider = providers.find(
                    (p) => p.name.toLowerCase() === existingCertificate.providerName?.toLowerCase(),
                  );
                  const isOthers = existingCertificate.providerName?.toLowerCase() === "others";
                  if (isOthers) {
                    return (
                      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600">
                        <div className="h-2 w-2 rounded-full bg-white"></div>
                      </div>
                    );
                  } else if (provider?.icon) {
                    return (
                      <img
                        src={provider.icon}
                        alt={provider.name}
                        width={16}
                        height={16}
                        className="h-4 w-4 object-contain"
                      />
                    );
                  }
                  return null;
                })()}
                <span>{existingCertificate.providerName}</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">URL</p>
              <div className="break-all text-sm font-medium">
                {existingCertificate.jwksUrl || existingCertificate.publicCertificatePath || "-"}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Issuer</p>
              <div className="break-all text-sm font-medium">
                {existingCertificate.issuer || "-"}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Audience</p>
              <div className="break-all text-sm font-medium">
                {existingCertificate.audiences?.length
                  ? existingCertificate.audiences.join(", ")
                  : "-"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <MapJwtClaimModal
        open={isJwtClaimModalOpen}
        onOpenChange={(open) => void setIsJwtClaimModalOpen(open)}
      />
      <AddEditProviderModal
        open={isEditModalOpen}
        onOpenChange={(open) => void setIsEditModalOpen(open)}
        existingData={existingCertificate}
      />
    </>
  );
};
