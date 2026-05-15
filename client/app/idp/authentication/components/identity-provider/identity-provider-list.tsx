import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui-kits/card/card";
import { useGetIdentityProviders } from "@blocks-idp/authentication/hooks/use-identity-provider";
import { IdentityProviderCard } from "./identity-provider-card";
import { Globe } from "lucide-react";

const LoadingSkeleton = () => (
  <div className="grid gap-4">
    {[1, 2].map((i) => (
      <Card key={i} className="py-5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div>
                <Skeleton className="mb-1 h-4 w-36 rounded" />
                <Skeleton className="h-3 w-24 rounded" />
              </div>
              <Skeleton className="h-5 w-14 rounded" />
              <Skeleton className="h-5 w-16 rounded" />
            </div>
            <div className="flex gap-1">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4].map((j) => (
              <div key={j}>
                <Skeleton className="mb-1 h-3 w-20 rounded" />
                <Skeleton className="h-4 w-32 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

export function IdentityProviderList() {
  const { data, isLoading, isFetching } = useGetIdentityProviders();

  if (isLoading || isFetching) return <LoadingSkeleton />;

  const providers = data?.data ?? [];

  if (!providers.length) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-background text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Globe className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">No identity providers configured</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Click "Add Identity Provider" to connect an external IdP.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {providers.map((provider) => (
        <IdentityProviderCard key={provider.itemId} provider={provider} />
      ))}
    </div>
  );
}
