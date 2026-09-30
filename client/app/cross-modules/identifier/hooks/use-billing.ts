import { useCallback, useEffect, useRef, useState } from "react";
import { billingService } from "@blocks-identifier/services/billing.service";
import {
  IOrderView,
  IPaymentMethodView,
  IStartCheckoutPayload,
  IStartCheckoutResult,
} from "@blocks-identifier/models/billing.model";

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
      await billingService.setDefaultCard(tenantGroupId, paymentMethodId);
      await load();
    },
    [tenantGroupId, load],
  );

  const remove = useCallback(
    async (paymentMethodId: string) => {
      if (!tenantGroupId) return;
      await billingService.removeCard(tenantGroupId, paymentMethodId);
      await load();
    },
    [tenantGroupId, load],
  );

  return { ...state, reload: load, setDefault, remove };
}

/**
 * Checkout, in the order the server expects.
 *
 * `start` is called when the screen opens so the idempotency key exists before anyone can press
 * anything. `pay` reuses that key on every attempt, which is what makes a double-click or a
 * retried request one charge instead of two.
 */
export function useCheckout(tenantGroupId: string | undefined) {
  const [quote, setQuote] = useState<IStartCheckoutResult | null>(null);
  /** The one order this checkout session owns, reused however often the selection changes. */
  const orderIdRef = useRef<string>("");
  const [order, setOrder] = useState<IOrderView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /** Prices a selection. Writes nothing, so it is safe to call on every change. */
  const priceOnly = useCallback(
    async (payload: Omit<IStartCheckoutPayload, "tenantGroupId">) => {
      if (!tenantGroupId) return null;

      setError(null);
      try {
        const response = await billingService.quote({ ...payload, tenantGroupId });
        setQuote((current) => ({
          ...response.checkout,
          // A quote carries no order or key; keep the ones this session already has so the pay
          // button stays armed while the selection is being adjusted.
          orderId: current?.orderId ?? "",
          idempotencyKey: current?.idempotencyKey ?? "",
        }));
        return response.checkout;
      } catch (caught) {
        setError(caught as Error);
        return null;
      }
    },
    [tenantGroupId],
  );

  /**
   * Writes the order and mints the key.
   *
   * Called once the selection is settled and before Pay can be pressed — never on the press
   * itself, where a double-click would produce two keys and two charges. Passing the session's
   * existing order re-prices it in place instead of leaving another behind.
   */
  const start = useCallback(
    async (payload: Omit<IStartCheckoutPayload, "tenantGroupId">) => {
      if (!tenantGroupId) return null;

      setBusy(true);
      setError(null);
      try {
        const response = await billingService.startCheckout({
          ...payload,
          tenantGroupId,
          orderId: orderIdRef.current || undefined,
        });
        orderIdRef.current = response.checkout.orderId;
        setQuote(response.checkout);
        return response.checkout;
      } catch (caught) {
        setError(caught as Error);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [tenantGroupId],
  );

  const pay = useCallback(
    async (paymentMethodId?: string) => {
      if (!tenantGroupId || !quote) return null;

      setBusy(true);
      setError(null);
      try {
        const response = await billingService.pay({
          tenantGroupId,
          orderId: quote.orderId,
          // Never regenerated. A fresh key here would be a second charge.
          idempotencyKey: quote.idempotencyKey,
          paymentMethodId,
        });
        setOrder(response.order);
        return response.order;
      } catch (caught) {
        setError(caught as Error);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [tenantGroupId, quote],
  );

  return { quote, order, busy, error, priceOnly, start, pay };
}
