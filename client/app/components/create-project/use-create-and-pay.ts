import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { billingService } from "@blocks-identifier/services/billing.service";
import { projectService as crossProjectService } from "@blocks-identifier/services/project.service";
import {
  IPaymentMethodView,
  IStartCheckoutResult,
  checkoutReasonMessage,
  checkoutRefusal,
} from "@blocks-identifier/models/billing.model";
import type { ICatalogueResponse } from "@blocks-identifier/models/catalogue.model";
import { repositoryKey, useCreateProjectFormState } from "./utils";
import { freeTierEnvironment, topUpSelections } from "./wizard-model";

export type CreateAndPayPhase =
  | "idle"
  | "creating"
  | "pricing"
  | "needCard"
  | "waitingForCard"
  | "paying"
  | "declined"
  | "failed";

/** How long to wait for Adyen's card webhook to land before telling the user. */
const CARD_WAIT_MS = 30_000;
const CARD_POLL_MS = 1_500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const usableCard = (cards: IPaymentMethodView[]) =>
  cards.find((c) => c.isDefault && !c.isExpired) ?? null;

/**
 * Create, price, pay — in that order, each step safe to repeat.
 *
 * 1. The project group is created once, with no environments (environments only ever come from a
 *    paid order). Its id is kept, so a retry never creates a second project.
 * 2. Checkout opens an order and mints the idempotency key before the button can be pressed twice.
 * 3. A paid order needs a default card on the new project; the card form is shown when it has none.
 * 4. Pay. A declined card leaves the project empty and nothing charged; "Try another card" starts
 *    a fresh order on the same project.
 * Then the order page takes over: provisioning runs in the background.
 */
export function useCreateAndPay(catalogue: ICatalogueResponse | null) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setTenantGroup } = useProjectStore();
  const state = useCreateProjectFormState();
  const [phase, setPhase] = useState<CreateAndPayPhase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<IStartCheckoutResult | null>(null);
  const [cards, setCards] = useState<IPaymentMethodView[]>([]);
  const cardIdsBefore = useRef<Set<string>>(new Set());
  const running = useRef(false);
  /** A declined order is final on the server; the next attempt must open a new one. */
  const orderClosed = useRef(false);

  const fail = (phaseTo: CreateAndPayPhase, text: string) => {
    setPhase(phaseTo);
    setMessage(text);
    running.current = false;
  };

  const ensureProject = async (): Promise<string | null> => {
    const existing = useCreateProjectFormState.getState().createdTenantGroupId;
    if (existing) return existing;

    setPhase("creating");
    const { naming, repositories } = state;
    const response = await crossProjectService.createProject({
      name: naming.name,
      description: naming.description || undefined,
      isAcceptBlocksTerms: naming.isAcceptBlocksTerms,
      isUseBlocksExclusively: naming.isUseBlocksExclusively,
      resources: repositories.assets.map((asset) => ({
        name: asset.full_name,
        link: asset.html_url,
        resourceId: repositoryKey(asset),
      })),
      applicationContexts: [],
      repositoryDeployments: repositories.assets
        .map((asset) => ({
          resourceId: repositoryKey(asset),
          environments: repositories.deployments[repositoryKey(asset)] ?? [],
        }))
        .filter((d) => d.environments.length > 0),
    } as Parameters<typeof crossProjectService.createProject>[0]);

    if (!response?.isSuccess || !response.tenantGroupId) {
      const reason = Object.values(response?.errors ?? {}).flat()[0];
      fail(
        "failed",
        reason
          ? `The project could not be created: ${reason}`
          : "The project could not be created.",
      );
      return null;
    }
    useCreateProjectFormState.getState().setCreatedTenantGroupId(response.tenantGroupId);
    setTenantGroup(response.tenantGroupId);
    queryClient.invalidateQueries({ queryKey: ["identifier", "projects"] });
    return response.tenantGroupId;
  };

  const openOrder = async (tenantGroupId: string, previousOrderId?: string) => {
    setPhase("pricing");
    const { selection } = useCreateProjectFormState.getState();
    const free = catalogue ? freeTierEnvironment(catalogue) : null;
    const response = await billingService.startCheckout({
      tenantGroupId,
      environments: selection.environments,
      topUps: topUpSelections(selection),
      freeTier: selection.devTier === "free" && !!free && selection.environments.includes(free),
      orderId: previousOrderId,
    });
    const refusal = checkoutRefusal(response);
    if (refusal || !response.checkout) {
      fail("failed", checkoutReasonMessage(refusal));
      return null;
    }
    setCheckout(response.checkout);
    return response.checkout;
  };

  const loadCards = async (tenantGroupId: string) => {
    const response = await billingService.getCards(tenantGroupId);
    const list = response?.cards ?? [];
    setCards(list);
    return list;
  };

  const pay = async (tenantGroupId: string, order: IStartCheckoutResult) => {
    setPhase("paying");
    const response = await billingService.pay({
      tenantGroupId,
      orderId: order.orderId,
      idempotencyKey: order.idempotencyKey,
    });
    const refusal =
      checkoutRefusal(response) ??
      (response.order?.state?.startsWith("checkout_") ? response.order.state : null);
    if (refusal || response.order?.state === "declined") {
      orderClosed.current = true;
      fail(
        "declined",
        checkoutReasonMessage(refusal ?? response.order?.declineReason ?? "declined"),
      );
      return;
    }
    running.current = false;
    useCreateProjectFormState.getState().resetFormData();
    navigate(`/app/creating/${tenantGroupId}?order=${encodeURIComponent(order.orderId)}`);
  };

  /** The button. Safe to press again after a refusal: every step resumes where it stopped. */
  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setMessage(null);
    try {
      const tenantGroupId = await ensureProject();
      if (!tenantGroupId) return;

      // A declined order is closed; a pending one is re-priced in place.
      const reuse = orderClosed.current ? undefined : checkout?.orderId || undefined;
      const order = await openOrder(tenantGroupId, reuse);
      if (!order) return;
      orderClosed.current = false;

      if (order.total > 0) {
        const list = await loadCards(tenantGroupId);
        if (!usableCard(list)) {
          cardIdsBefore.current = new Set(list.map((c) => c.paymentMethodId));
          setPhase("needCard");
          running.current = false;
          return;
        }
      }
      await pay(tenantGroupId, order);
    } catch (caught) {
      fail("failed", (caught as Error)?.message || "Something went wrong. Nothing was charged.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkout, catalogue]);

  /**
   * After the card form closes successfully. The card is stored by Adyen's webhook, not by the
   * form, so wait for it to appear; a newly added card is made the default so Pay charges it.
   */
  const cardAdded = useCallback(async () => {
    const tenantGroupId = useCreateProjectFormState.getState().createdTenantGroupId;
    if (!tenantGroupId) return;
    running.current = true;
    // The card form closes (reporting a cancel) just before it reports success; clear that.
    setMessage(null);
    setPhase("waitingForCard");
    try {
      const deadline = Date.now() + CARD_WAIT_MS;
      let added: IPaymentMethodView | undefined;
      while (Date.now() < deadline) {
        const list = await loadCards(tenantGroupId);
        added = list.find((c) => !cardIdsBefore.current.has(c.paymentMethodId) && !c.isExpired);
        if (added) break;
        await sleep(CARD_POLL_MS);
      }
      if (!added) {
        fail(
          "needCard",
          "The card hasn't reached us yet. Give it a moment and press the button again.",
        );
        return;
      }
      if (!added.isDefault)
        await billingService.setDefaultCard(tenantGroupId, added.paymentMethodId);
      let order = checkout;
      if (!order || orderClosed.current) {
        order = await openOrder(tenantGroupId);
        if (!order) return;
        orderClosed.current = false;
      }
      await pay(tenantGroupId, order);
    } catch (caught) {
      fail("failed", (caught as Error)?.message || "Something went wrong. Nothing was charged.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkout]);

  /** "Try another card" after a decline: open the card form for the same project. */
  const chooseAnotherCard = useCallback(() => {
    cardIdsBefore.current = new Set(cards.map((c) => c.paymentMethodId));
    setPhase("needCard");
  }, [cards]);

  /** The card form was closed without a card. Nothing was charged; the button resumes from here. */
  const cancelCard = useCallback(() => {
    running.current = false;
    setPhase("idle");
    setMessage("Add a card to finish. The project is saved and nothing has been charged.");
  }, []);

  return {
    phase,
    message,
    checkout,
    cards,
    tenantGroupId: state.createdTenantGroupId,
    busy: ["creating", "pricing", "paying", "waitingForCard"].includes(phase),
    run,
    cardAdded,
    cancelCard,
    chooseAnotherCard,
  };
}
