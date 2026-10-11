import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { billingService } from "@blocks-identifier/services/billing.service";
import {
  IPaymentMethodView,
  billingReasonMessage,
  billingRefusal,
} from "@blocks-identifier/models/billing.model";

/** A card action the server refused (HTTP 200, isSuccess false) becomes an error the page shows. */
const throwIfRefused = (response: unknown) => {
  const refusal =
    response && typeof response === "object"
      ? billingRefusal(response as { isSuccess?: boolean })
      : null;
  if (refusal) throw new Error(billingReasonMessage(refusal));
};

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/** Cards on file for a project. Brand and last four only — the token never leaves the vault. */
export function useCards(tenantGroupId: string | undefined) {
  const [state, setState] = useState<AsyncState<IPaymentMethodView[]>>({
    data: null,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    if (!tenantGroupId) {
      setState({ data: [], loading: false, error: null });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const response = await billingService.getCards(tenantGroupId);
      setState({ data: response.cards ?? [], loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error: error as Error });
    }
  }, [tenantGroupId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setDefault = useCallback(
    async (paymentMethodId: string) => {
      if (!tenantGroupId) return;
      throwIfRefused(await billingService.setDefaultCard(tenantGroupId, paymentMethodId));
      await load();
    },
    [tenantGroupId, load],
  );

  const remove = useCallback(
    async (paymentMethodId: string) => {
      if (!tenantGroupId) return;
      throwIfRefused(await billingService.removeCard(tenantGroupId, paymentMethodId));
      await load();
    },
    [tenantGroupId, load],
  );

  return { ...state, reload: load, setDefault, remove };
}

/** What the project pays each period. Shared cache, so the console and billing agree. */
export function useSubscription(tenantGroupId: string | undefined) {
  return useQuery({
    queryKey: ["billing", "subscription", tenantGroupId],
    queryFn: () => billingService.getSubscription(tenantGroupId as string),
    enabled: !!tenantGroupId,
    select: (response) => response.subscription,
  });
}
