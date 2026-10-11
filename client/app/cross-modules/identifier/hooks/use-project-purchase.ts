import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { billingService } from "@blocks-identifier/services/billing.service";
import {
  IPaymentMethodView,
  IStartCheckoutResult,
  ITopUpSelection,
  checkoutReasonMessage,
  checkoutRefusal,
} from "@blocks-identifier/models/billing.model";

export interface PurchaseSelection {
  environments: string[];
  topUps: ITopUpSelection[];
  /** Move the project's free-tier environment to its paid price. */
  upgradeFreeTier?: boolean;
}

export type PurchasePhase =
  "idle" | "pricing" | "needCard" | "waitingForCard" | "paying" | "declined" | "failed";

const CARD_WAIT_MS = 30_000;
const CARD_POLL_MS = 1_500;
const QUOTE_DEBOUNCE_MS = 300;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isEmpty = (s: PurchaseSelection) =>
  s.environments.length === 0 && s.topUps.length === 0 && !s.upgradeFreeTier;

/**
 * Buying something for a project that already exists: environments (prorated), top-ups, or the
 * free tier's upgrade.
 *
 * The figure on screen is the server's quote, refreshed as the selection changes — the quote
 * saves nothing. Buy opens the order (minting the idempotency key), asks for a card only when the
 * project has none, pays, and hands over to the order page. A decline charges nothing and leaves
 * the selection as it was.
 */
export function useProjectPurchase(
  tenantGroupId: string | undefined,
  selection: PurchaseSelection,
) {
  const navigate = useNavigate();
  const [quote, setQuote] = useState<IStartCheckoutResult | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [phase, setPhase] = useState<PurchasePhase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const order = useRef<IStartCheckoutResult | null>(null);
  const knownCards = useRef<Set<string>>(new Set());
  const key = JSON.stringify(selection);

  // The live price. Stale answers are dropped so a fast clicker never sees an older total.
  useEffect(() => {
    // An empty selection shows no price (see the return); nothing to ask the server.
    if (!tenantGroupId || isEmpty(selection)) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      billingService
        .quote({ tenantGroupId, ...selection })
        .then((response) => {
          if (cancelled) return;
          const refusal = checkoutRefusal(response);
          if (refusal || !response.checkout) {
            setQuote(null);
            setQuoteError(checkoutReasonMessage(refusal));
          } else {
            setQuote(response.checkout);
            setQuoteError(null);
          }
        })
        .catch(
          () =>
            !cancelled && setQuoteError("The price could not be checked. Try again in a moment."),
        );
    }, QUOTE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantGroupId, key]);

  const fail = (to: PurchasePhase, text: string) => {
    setPhase(to);
    setMessage(text);
  };

  const pay = async (opened: IStartCheckoutResult) => {
    if (!tenantGroupId) return;
    setPhase("paying");
    const response = await billingService.pay({
      tenantGroupId,
      orderId: opened.orderId,
      idempotencyKey: opened.idempotencyKey,
    });
    const refusal =
      checkoutRefusal(response) ??
      (response.order?.state?.startsWith("checkout_") ? response.order.state : null);
    if (refusal || response.order?.state === "declined") {
      // A declined order is closed on the server; the next attempt opens a new one.
      order.current = null;
      fail("declined", checkoutReasonMessage(refusal ?? "declined"));
      return;
    }
    setPhase("idle");
    navigate(`/app/project/${tenantGroupId}/order?order=${encodeURIComponent(opened.orderId)}`);
  };

  const open = async (): Promise<IStartCheckoutResult | null> => {
    if (!tenantGroupId) return null;
    setPhase("pricing");
    const response = await billingService.startCheckout({
      tenantGroupId,
      ...selection,
      orderId: order.current?.orderId || undefined,
    });
    const refusal = checkoutRefusal(response);
    if (refusal || !response.checkout) {
      order.current = null;
      fail("failed", checkoutReasonMessage(refusal));
      return null;
    }
    order.current = response.checkout;
    return response.checkout;
  };

  const buy = useCallback(async () => {
    if (
      !tenantGroupId ||
      isEmpty(selection) ||
      ["pricing", "paying", "waitingForCard"].includes(phase)
    )
      return;
    setMessage(null);
    try {
      const opened = await open();
      if (!opened) return;
      if (opened.total > 0) {
        const cards = (await billingService.getCards(tenantGroupId))?.cards ?? [];
        if (!cards.some((c) => c.isDefault && !c.isExpired)) {
          knownCards.current = new Set(cards.map((c) => c.paymentMethodId));
          setPhase("needCard");
          return;
        }
      }
      await pay(opened);
    } catch (caught) {
      fail("failed", (caught as Error)?.message || "Something went wrong. Nothing was charged.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantGroupId, key, phase]);

  /** After the card form reports success: wait for the card (it arrives by webhook), make it the default, pay. */
  const cardAdded = useCallback(async () => {
    if (!tenantGroupId) return;
    setMessage(null);
    setPhase("waitingForCard");
    try {
      const deadline = Date.now() + CARD_WAIT_MS;
      let added: IPaymentMethodView | undefined;
      while (Date.now() < deadline) {
        const cards = (await billingService.getCards(tenantGroupId))?.cards ?? [];
        added = cards.find((c) => !knownCards.current.has(c.paymentMethodId) && !c.isExpired);
        if (added) break;
        await sleep(CARD_POLL_MS);
      }
      if (!added) {
        fail("idle", "The card hasn't reached us yet. Give it a moment and press Buy again.");
        return;
      }
      if (!added.isDefault)
        await billingService.setDefaultCard(tenantGroupId, added.paymentMethodId);
      const opened = order.current ?? (await open());
      if (opened) await pay(opened);
    } catch (caught) {
      fail("failed", (caught as Error)?.message || "Something went wrong. Nothing was charged.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantGroupId, key]);

  const cancelCard = useCallback(() => {
    setPhase("idle");
    setMessage("Add a card to finish. Nothing has been charged.");
  }, []);

  /** "Try another card" after a decline. */
  const chooseAnotherCard = useCallback(async () => {
    if (!tenantGroupId) return;
    const cards = (await billingService.getCards(tenantGroupId))?.cards ?? [];
    knownCards.current = new Set(cards.map((c) => c.paymentMethodId));
    setPhase("needCard");
  }, [tenantGroupId]);

  const empty = isEmpty(selection);
  return {
    quote: empty ? null : quote,
    quoteError: empty ? null : quoteError,
    phase,
    message,
    busy: ["pricing", "paying", "waitingForCard"].includes(phase),
    buy,
    cardAdded,
    cancelCard,
    chooseAnotherCard,
  };
}
