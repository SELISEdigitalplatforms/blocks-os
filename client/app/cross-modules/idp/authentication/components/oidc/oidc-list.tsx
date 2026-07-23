import { useGetAuthOidcCredentials } from "@blocks-idp/authentication/hooks/use-auth-oidc";
import { useMemo } from "react";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { EmptyState } from "@/components/ui-kits/empty-state";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Shield } from "lucide-react";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { OIDCRowExport } from "./oidc-card";

const LoadingSkeleton = () => (
  <Card>
    <CardContent className="p-0">
      <div className="border-b px-4 py-3 flex items-center gap-4 bg-muted/40">
        <Skeleton className="h-3 w-4" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-24" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b px-4 py-4 last:border-0"
        >
          <Skeleton className="h-4 w-4 rounded" />
          <div className="flex items-center gap-2 flex-1">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div>
              <Skeleton className="mb-1 h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-3 w-24" />
          <div className="ml-auto flex gap-1.5">
            <Skeleton className="h-7 w-7 rounded" />
            <Skeleton className="h-7 w-7 rounded" />
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
);

export const OidcList = () => {
  const { tenantId } = useProjectStore().selectedProject || { tenantId: "" };
  const { isLoading, isFetching, data } = useGetAuthOidcCredentials({
    projectKey: tenantId,
  });
  const sortedOidcData = useMemo(() => {
    if (!data || !data.oIDCClientCredentials) return [];
    const dataArray = Array.isArray(data.oIDCClientCredentials)
      ? data.oIDCClientCredentials
      : [data.oIDCClientCredentials];
    if (dataArray.length === 0) return [];
    return [...dataArray].sort((a, b) => {
      const dateA = new Date(a.createdDate).getTime();
      const dateB = new Date(b.createdDate).getTime();
      return dateB - dateA;
    });
  }, [data]);

  if (isLoading || isFetching) return <LoadingSkeleton />;

  if (!sortedOidcData.length) {
    return (
      <EmptyState
        icon={Shield}
        title="No OIDC clients yet"
        description="Add your first OIDC client to get started."
      />
    );
  }

  return (
    <Card>
      <CardContent className="overflow-x-clip p-0 sm:overflow-x-auto">
        <Table className="w-full min-w-0 sm:table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8 pl-4" />
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-high-emphasis sm:w-64">
                Client
              </TableHead>
              <TableHead className="hidden w-32 text-xs font-semibold uppercase tracking-wide text-high-emphasis sm:table-cell">
                Type
              </TableHead>
              <TableHead className="hidden w-40 text-xs font-semibold uppercase tracking-wide text-high-emphasis md:table-cell">
                Created On
              </TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody className="[&_tr:last-child]:border-b">
            {sortedOidcData.map((item, index) => (
              <OIDCRowExport
                key={item.itemId}
                item={item}
                defaultExpanded={index === 0}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
