import { TRACE_PROVIDERS } from "@blocks-lmt/constants/trace.constant";
import { useQueryState } from "nuqs";
import type { StorageTier } from "../components/storage-tier-cards/storage-tier-cards";

/**
 * The storage tier the logs list is being read at, kept in the URL.
 *
 * Under its own param name rather than Tracing's "tab": on the per-service logs route "tab"
 * already means the service tab, and log rows copy that param onto their trace links.
 *
 * A restore belongs to a project. Without one -- the per-service logs route passes none --
 * there is nothing to read on the restored tiers, so the param is ignored there.
 *
 * Shared by the viewer and the Logs page header, which both need the tier: the header only to
 * know whether the agent, which queries hot storage, has anything to say about what is on
 * screen.
 */
export const useLogsTier = (canReadRestores: boolean) => {
  const [tierParam, setTierParam] = useQueryState("tier", { defaultValue: TRACE_PROVIDERS.hot });
  const requestedTier = (
    Object.values(TRACE_PROVIDERS).includes(tierParam as TRACE_PROVIDERS)
      ? tierParam
      : TRACE_PROVIDERS.hot
  ) as StorageTier;

  return {
    tier: (canReadRestores ? requestedTier : TRACE_PROVIDERS.hot) as StorageTier,
    setTier: setTierParam,
  };
};
