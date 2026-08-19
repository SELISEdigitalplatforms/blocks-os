import { hashKey, type Query, type QueryKey } from "@tanstack/react-query";
import { useImpersonateStore } from "@seliseblocks/genesis-os/store";

/**
 * Tenant scoping for the TanStack cache.
 *
 * The backend resolves the tenant from the request token, never from a parameter we send, so the
 * tenant is ambient state: it is swapped underneath us by `ImpersonationSynchronizer` when the user
 * opens a different project. Query keys, on the other hand, are written per call site. Any key that
 * does not restate the tenant therefore collides across projects -- open Roles in project A, switch
 * to project B, and the identical key `["roles", {page:0,...,organizationId:"default"}]` serves A's
 * rows out of cache with no refetch inside the 60s `staleTime`.
 *
 * Restating the tenant at ~200 call sites is a rule people forget, so instead the cache is
 * partitioned at the client level: every key is hashed together with the effective tenant. Nothing
 * to remember, nothing to miss, and it covers hooks that do not exist yet.
 *
 * Note this changes cache identity only. The query key never leaves the browser -- the wire format
 * is untouched and no endpoint learns about a new parameter.
 */

/**
 * Keys that must NOT be tenant scoped, because they are what *establishes* the tenant.
 *
 * `["blocks-kit-impersonation", "status"]` feeds the store this module reads. Scoping it would mean
 * the entry changes identity the instant it resolves (unknown tenant -> real tenant), so the
 * checker would fall back to loading and refetch on every boot and every switch -- and
 * `useStartImpersonation`/`useStopImpersonation` write it through `setQueryData`, which would land
 * in a different entry than the checker reads.
 *
 * This is a self-reference exemption, not a convenience allowlist. Nothing belongs here unless the
 * query participates in resolving which tenant we are in.
 */
export const TENANT_AGNOSTIC_KEY_PREFIXES: readonly string[] = ["blocks-kit-impersonation"];

/**
 * The tenant our requests actually run under.
 *
 * Deliberately the impersonation store and not `useProjectStore().selectedProject`: the former is
 * hydrated from the server's impersonation-status endpoint, so it mirrors the `tenant_id` claim in
 * the token the API will read. The latter is derived from the URL and the projects list and can
 * drift from it. Same derivation as `useProjectsQuery` in `app/hooks/use-project.ts`.
 */
export const getEffectiveTenantId = (): string => {
  const { isImpersonated, impersonatedTenantId, originalTenantId } = useImpersonateStore.getState();
  return (isImpersonated ? impersonatedTenantId : originalTenantId) ?? "";
};

export const isTenantAgnosticQueryKey = (queryKey: QueryKey): boolean =>
  typeof queryKey[0] === "string" && TENANT_AGNOSTIC_KEY_PREFIXES.includes(queryKey[0]);

/**
 * `queryKeyHashFn` for the app's QueryClient.
 *
 * Hashing the composite `[tenantId, queryKey]` rather than concatenating strings keeps the result
 * unambiguous by construction, and leaves the tenant readable at the front of the hash in devtools
 * -- which matters, because this partitioning is otherwise invisible there.
 *
 * Filters (`invalidateQueries({ queryKey: ["roles"] })`) still match on the key array, not the
 * hash, so existing prefix invalidation keeps working and reaches every tenant's entries. That is
 * harmless: entries for a tenant we are not in have no observers, so they are marked stale and
 * refetch only if we return to that tenant.
 */
export const tenantScopedQueryKeyHashFn = (queryKey: QueryKey): string =>
  isTenantAgnosticQueryKey(queryKey)
    ? hashKey(queryKey)
    : hashKey([getEffectiveTenantId(), queryKey]);

/**
 * True when a cached query belongs to a tenant other than the current one -- i.e. its stored hash
 * is not what its key would hash to now. Tenant-agnostic entries hash identically either way and so
 * are never selected.
 */
export const isForeignTenantQuery = (query: Query): boolean =>
  query.queryHash !== tenantScopedQueryKeyHashFn(query.queryKey);
