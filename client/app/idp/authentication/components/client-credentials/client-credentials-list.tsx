import { ClientCredentialsCard } from "./client-credential-card";
import { IClientCredentialsConfig } from "@blocks-idp/authentication/models/auth.oidc.model";
import { Card, CardContent, CardHeader } from "@/components/ui-kits/card/card";
import { EmptyState } from "@/components/ui-kits/empty-state";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { KeyRound } from "lucide-react";
import { type ReactNode, useMemo } from "react";

const SkeletonField = ({
  labelWidth,
  children,
}: {
  labelWidth: string
  children: ReactNode
}) => (
  <div className="min-w-0">
    <Skeleton className={`mb-2 h-4 rounded ${labelWidth}`} />
    {children}
  </div>
)

const CardSkeleton = () => (
  <Card className="overflow-hidden rounded-sm border bg-card py-4 shadow-sm sm:py-6">
    <CardHeader className="px-4 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
          <Skeleton className="h-7 w-24 rounded sm:h-8 sm:w-28" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Skeleton className="h-9 w-full rounded sm:w-20" />
          <Skeleton className="h-9 w-full rounded sm:w-20" />
        </div>
      </div>
    </CardHeader>
    <CardContent className="px-4 sm:px-6">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-6">
        <div className="flex flex-col gap-6">
          <SkeletonField labelWidth="w-20">
            <Skeleton className="h-5 w-full max-w-[220px] rounded" />
          </SkeletonField>
          <SkeletonField labelWidth="w-16">
            <Skeleton className="h-6 w-24 rounded-full" />
          </SkeletonField>
        </div>

        <div className="flex flex-col gap-6">
          <SkeletonField labelWidth="w-24">
            <Skeleton className="h-5 w-full max-w-[220px] rounded" />
          </SkeletonField>
          <SkeletonField labelWidth="w-24">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-6 w-full max-w-[280px] rounded-full" />
              <Skeleton className="h-6 w-full max-w-[300px] rounded-full" />
              <Skeleton className="h-6 w-full max-w-[260px] rounded-full" />
              <Skeleton className="h-6 w-full max-w-[240px] rounded-full" />
              <Skeleton className="h-6 w-full max-w-[220px] rounded-full" />
            </div>
          </SkeletonField>
        </div>

        <div className="flex flex-col gap-6">
          <SkeletonField labelWidth="w-24">
            <Skeleton className="h-5 w-12 rounded" />
          </SkeletonField>
          <SkeletonField labelWidth="w-20">
            <Skeleton className="h-5 w-36 rounded" />
          </SkeletonField>
          <SkeletonField labelWidth="w-20">
            <Skeleton className="h-5 w-36 rounded" />
          </SkeletonField>
        </div>
      </div>
    </CardContent>
  </Card>
)

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
    <div className="grid gap-4">
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
