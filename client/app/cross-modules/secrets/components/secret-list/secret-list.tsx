import { KeyRound, SearchX, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { EmptyState } from "@/components/ui-kits/empty-state";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { useFindSecrets } from "@/cross-modules/secrets/hooks/use-secret-management";
import { describeSecretError } from "@/cross-modules/secrets/utils/secret-error";
import { SecretRow } from "../secret-row/secret-row";
import { SecretToolbar, useSecretFilterQueryParams } from "../secret-toolbar/secret-toolbar";

const COLUMNS = ["Secret", "Type", "Status", "Created On"] as const;

const ListSkeleton = () => (
  <TableBody>
    {Array.from({ length: 5 }).map((_, index) => (
      <TableRow key={index}>
        <TableCell className="w-8 py-4 pl-4">
          <Skeleton className="h-4 w-4 rounded" />
        </TableCell>
        <TableCell className="py-4">
          <Skeleton className="h-4 w-40" />
        </TableCell>
        <TableCell className="py-4">
          <Skeleton className="h-5 w-16 rounded" />
        </TableCell>
        <TableCell className="py-4">
          <Skeleton className="h-5 w-16 rounded" />
        </TableCell>
        <TableCell className="py-4">
          <Skeleton className="h-3 w-24" />
        </TableCell>
        <TableCell className="py-4 pr-4">
          <div className="flex justify-end gap-1.5">
            <Skeleton className="h-7 w-7 rounded" />
            <Skeleton className="h-7 w-7 rounded" />
          </div>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
);

/**
 * The secret-management list.
 *
 * Server-paginated: `totalCount` drives the control and the query refetches per page, so
 * nothing here filters or sorts client-side. Filters live in the URL (see
 * {@link useSecretFilterQueryParams}) so the view survives a reload and can be linked to.
 */
export function SecretList() {
  const { values, filter, queryParams, setPage, setPageSize } = useSecretFilterQueryParams();
  const { data, isLoading, isFetching, error } = useFindSecrets(filter);

  const secrets = data?.data ?? [];
  const totalCount = data?.totalCount ?? 0;
  const isBusy = isLoading || isFetching;
  const hasFilters = !!values.search || !!values.type || !!values.status;

  // 403 is a routine outcome, not a bug: the value/rotate/access/audit endpoints default to
  // admin-only, and until secret permissions are seeded for a tenant every endpoint refuses.
  // Neither should read as a crash.
  const errorInfo = error ? describeSecretError(error, "Could not load secrets.") : null;

  return (
    // Toolbar, table and pagination share one card, matching the Roles and Users screens — the
    // filters belong to the table, so putting them on the page background split the two apart.
    <Card>
      <CardContent className="space-y-3 p-3 sm:p-4">
        <SecretToolbar />

        {errorInfo ? (
          <EmptyState
            className="border-0 shadow-none"
            icon={ShieldAlert}
            title={
              errorInfo.status === 403 ? "Not available for your account" : "Secrets unavailable"
            }
            description={errorInfo.message}
          />
        ) : (
          <>
            <div className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-8 pl-4" />
                    {COLUMNS.map((column) => (
                      <TableHead
                        key={column}
                        className="text-xs font-semibold uppercase tracking-wide text-high-emphasis"
                      >
                        {column}
                      </TableHead>
                    ))}
                    <TableHead className="pr-4 text-right text-xs font-semibold uppercase tracking-wide text-high-emphasis">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>

                {isBusy ? (
                  <ListSkeleton />
                ) : (
                  <TableBody>
                    {secrets.length ? (
                      secrets.map((secret) => <SecretRow key={secret.secretId} secret={secret} />)
                    ) : (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6} className="p-0">
                          <EmptyState
                            className="border-0 shadow-none"
                            icon={hasFilters ? SearchX : KeyRound}
                            title={hasFilters ? "No matching secrets" : "No secrets yet"}
                            description={
                              hasFilters
                                ? "Try a different search or clear the filters."
                                : "Create your first secret to get started."
                            }
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                )}
              </Table>
            </div>

            {!isBusy && totalCount > queryParams.secretPageSize && (
              <div className="flex items-center md:justify-end">
                <Pagination
                  compact
                  page={queryParams.secretPage}
                  pageSize={queryParams.secretPageSize}
                  totalCount={totalCount}
                  pageSizeOptions={[10, 20, 50]}
                  onChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
