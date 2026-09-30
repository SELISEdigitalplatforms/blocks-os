import { useCallback, useEffect, useState } from "react";
import { catalogueService } from "@blocks-identifier/services/catalogue.service";
import {
  ICatalogueResponse,
  IProjectUsage,
} from "@blocks-identifier/models/catalogue.model";

/** One environment as the create flow needs it, derived entirely from the published catalogue. */
export interface IEnvironmentOption {
  value: string;
  label: string;
  rank: number;
  price: number | null;
  freePrice: number | null;
  freeTierAvailable: boolean;
  topUpUncapped: boolean;
  /** Keyed by `service.meter`. -1 means uncapped. */
  limits: Record<string, number>;
}

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/** The published catalogue. Everything the create flow and the limits panel render comes from here. */
export function useCatalogue(market?: string) {
  const [state, setState] = useState<AsyncState<ICatalogueResponse>>({
    data: null,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await catalogueService.getCatalogue(market);
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error: error as Error });
    }
  }, [market]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: load };
}

/**
 * A project's usage, one block per environment, and the sync that gives an environment rows for
 * anything newly published.
 *
 * Scoped to the project group. Nothing is inferred from the session: without a group the hook
 * stays empty rather than quietly answering for whichever project happened to be open.
 */
export function useUsage(tenantGroupId: string | undefined) {
  const [state, setState] = useState<AsyncState<IProjectUsage>>({
    data: null,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    if (!tenantGroupId) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const response = await catalogueService.getUsage(tenantGroupId);
      setState({ data: response.usage, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error: error as Error });
    }
  }, [tenantGroupId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** The group authorises the call; the tenant says which environment of it to sync. */
  const sync = useCallback(
    async (tenantId: string, environment: string, periodKey: string, freeTier = false) => {
      if (!tenantGroupId) return null;

      const result = await catalogueService.syncUsage({
        tenantGroupId,
        tenantId,
        environment,
        periodKey,
        freeTier,
      });
      await load();
      return result;
    },
    [tenantGroupId, load],
  );

  return { ...state, reload: load, sync };
}

/**
 * The environments a project may have, in catalogue order.
 *
 * There is no list of environment names in the front end. Publishing a new environment into the
 * catalogue makes it selectable here, with its price and its limits, and removing one takes it
 * away — no release either way.
 */
export function useEnvironmentOptions(market?: string) {
  const { data, loading, error, reload } = useCatalogue(market);

  const options: IEnvironmentOption[] = data
    ? Object.entries(data.environments)
        .map(([value, env]) => ({
          value,
          label: env.label,
          rank: env.rank,
          price: env.price ?? null,
          freePrice: env.freePrice ?? null,
          freeTierAvailable: env.freeTierAvailable,
          topUpUncapped: env.topUpUncapped,
          limits: env.limits,
        }))
        .sort((a, b) => a.rank - b.rank)
    : [];

  return { options, market: data?.market ?? null, loading, error, reload };
}
