import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { getQueryClient as getGenesisQueryClient } from "@seliseblocks/genesis-os/providers";
import type * as React from "react";
import { getRollbar } from "@/lib/rollbar";
import { attachQueryErrorReporting } from "@/lib/query/report-query-errors";
import { tenantScopedQueryKeyHashFn } from "@/lib/query/tenant-query-scope";
import { TenantCacheBoundary } from "./tenant-cache-boundary";

let isConfigured = false;

/**
 * The app deliberately renders genesis-os's QueryClient rather than one of its own.
 *
 * The package's `HttpClient.handleRefreshFailure` clears the cache through its own module-level
 * `getQueryClient()`. While this app built a second client, that call cleared an instance nothing
 * rendered, so an auth failure left the real cache intact. Sharing one instance repairs that, and
 * it is also the only way tenant partitioning can be trusted -- a second cache would be unscoped.
 *
 * `setDefaultOptions` replaces rather than merges, so the package's own defaults (`staleTime`,
 * `retry`) are restated here alongside ours.
 */
export const getQueryClient = () => {
  const queryClient = getGenesisQueryClient();
  if (!isConfigured) {
    isConfigured = true;
    queryClient.setDefaultOptions({
      queries: {
        staleTime: 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
        // Partitions every cache entry by the tenant the request runs under. See
        // `app/lib/query/tenant-query-scope.ts` for why this lives here and not at the call sites.
        queryKeyHashFn: tenantScopedQueryKeyHashFn,
      },
    });

    // Subscribed once, alongside the defaults, and never detached: the client is an
    // app-lifetime singleton, so there is nothing to clean up.
    attachQueryErrorReporting(queryClient, getRollbar());
  }
  return queryClient;
};

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <TenantCacheBoundary />
      {children}
      <ReactQueryDevtools buttonPosition="bottom-left" />
    </QueryClientProvider>
  );
}
