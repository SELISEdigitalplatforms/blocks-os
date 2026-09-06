import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useImpersonateStore } from "@seliseblocks/genesis-os/store";
import { isForeignTenantQuery } from "@/lib/query/tenant-query-scope";

/**
 * Closes the one gap `tenantScopedQueryKeyHashFn` cannot: a request fired under project A that is
 * still in flight when the impersonation cookie flips to B. It was sent with A's token but may be
 * served with B's, and its result would be filed under A.
 *
 * Only queries belonging to another tenant are cancelled. Cancelling everything would also kill the
 * fetches the current screen just started under the new tenant -- child effects run before parent
 * effects, so by the time this runs the observers have already rehashed into the new scope and
 * begun loading. Those must be left alone; a cancelled query with observers does not retry on its
 * own and the screen would sit empty.
 *
 * Entries for the tenant we left are kept, not removed: they cost nothing beyond the existing
 * 5-minute `gcTime` and make switching back instant.
 */
export const TenantCacheBoundary = () => {
  const queryClient = useQueryClient();
  const { isImpersonated, impersonatedTenantId, originalTenantId } = useImpersonateStore();
  const tenantId = (isImpersonated ? impersonatedTenantId : originalTenantId) ?? "";
  const previousTenantId = useRef(tenantId);

  useEffect(() => {
    if (previousTenantId.current === tenantId) return;
    previousTenantId.current = tenantId;
    void queryClient.cancelQueries({ predicate: isForeignTenantQuery });
  }, [queryClient, tenantId]);

  return null;
};
