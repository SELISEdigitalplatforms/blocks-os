import { ClientCredentialsCard } from "./client-credential-card";
import { IClientCredentialsConfig } from "@blocks-idp/authentication/models/auth.oidc.model";
import { Card, CardContent, CardHeader } from "@/components/ui-kits/card/card";
import { EmptyState } from "@/components/ui-kits/empty-state";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { KeyRound } from "lucide-react";
import { useMemo } from "react";

const CardSkeleton = () => (
  <Card className="py-6">
    <CardHeader>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-40 rounded" />
          <Skeleton className="h-5 w-14 rounded" />
        </div>
        <Skeleton className="h-8 w-20 rounded" />
      </div>
    </CardHeader>
    <CardContent>
      <div className="flex flex-col gap-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="min-w-0">
            <Skeleton className="mb-2 h-4 w-24 rounded" />
            <Skeleton className="h-5 w-40 rounded" />
          </div>
          <div className="min-w-0">
            <Skeleton className="mb-2 h-4 w-28 rounded" />
            <Skeleton className="h-5 w-40 rounded" />
          </div>
          <div className="min-w-0">
            <Skeleton className="mb-2 h-4 w-24 rounded" />
            <Skeleton className="h-5 w-32 rounded" />
          </div>
          <div className="min-w-0">
            <Skeleton className="mb-2 h-4 w-20 rounded" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16 rounded" />
              <Skeleton className="h-6 w-16 rounded" />
            </div>
          </div>
          <div className="min-w-0">
            <Skeleton className="mb-2 h-4 w-24 rounded" />
            <Skeleton className="h-5 w-32 rounded" />
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
);

const LoadingSkeleton = () => (
  <div className="grid gap-4">
    <CardSkeleton />
    <CardSkeleton />
  </div>
);

type ClientCredentialListProps = {
  data: IClientCredentialsConfig[];
  isLoading: boolean;
  onEdit?: (client: IClientCredentialsConfig) => void;
};

export const ClientCredentialList = ({ data, isLoading, onEdit }: ClientCredentialListProps) => {
  const sortedClientsData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return [...data].sort((a, b) => {
      const dateA = new Date(a.createdDate).getTime();
      const dateB = new Date(b.createdDate).getTime();
      return dateB - dateA;
    });
  }, [data]);

  if (isLoading) return <LoadingSkeleton />;
  if (!sortedClientsData.length)
    return (
      <EmptyState
        icon={KeyRound}
        title="No client credentials yet"
        description="Create one to issue OAuth client credentials for service-to-service access."
      />
    );
  return (
    <div>
      {sortedClientsData?.map((item) => (
        <ClientCredentialsCard
          key={item.itemId}
          clientCredential={item}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
};
