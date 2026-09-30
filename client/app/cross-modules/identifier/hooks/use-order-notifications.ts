import { useEffect, useRef, useState, useCallback } from "react";
import * as signalR from "@microsoft/signalr";
import { billingService } from "@blocks-identifier/services/billing.service";
import { IOrderView, isOrderInFlight } from "@blocks-identifier/models/billing.model";

/**
 * Where blocks-logic serves its notification hub. blocks-os hosts no hub of its own.
 */
const HUB_PATH = "/api/notificationHub";

/**
 * The two channels behind one visible notification.
 *
 * Progress is transient: it moves a bar on a screen already open, and missing it costs nothing
 * because the status message says what happened. Persisting all forty-two step messages would
 * bury every other notification the person has.
 */
const PROGRESS_METHOD = "SubscriptionOrderProgress";
const STATUS_METHOD = "SubscriptionOrderStatus";

interface OrderPush {
  orderId: string;
  state: string;
  headline?: string;
  stepsDone: number;
  stepsTotal: number;
  currentStep: string;
  currentEnvironment: string;
  attempt: number;
  maxAttempts: number;
  environments: IOrderView["environments"];
}

const toView = (push: OrderPush, previous: IOrderView | null): IOrderView => ({
  ...(previous ?? {
    total: 0,
    market: "CHF",
    declineReason: "",
    chargedAtUtc: null,
    completedAtUtc: null,
  }),
  orderId: push.orderId,
  state: push.state,
  stepsDone: push.stepsDone,
  stepsTotal: push.stepsTotal,
  currentStep: push.currentStep,
  currentEnvironment: push.currentEnvironment,
  attempt: push.attempt,
  maxAttempts: push.maxAttempts,
  environments: push.environments ?? [],
} as IOrderView);

/**
 * Watches the order a project is currently having built.
 *
 * Push, not polling: the worker sends each step as it finishes. Two things follow from that and
 * both are handled here.
 *
 * A reload loses the transient progress, so the hook asks once for the active order to rebuild the
 * bar and then listens. One request, not a poll.
 *
 * The entry is keyed by order id and replaced rather than appended, which is what keeps one
 * purchase to one notification however many steps it has.
 */
export function useOrderNotifications(tenantGroupId: string | undefined, logicBaseUrl?: string) {
  const [order, setOrder] = useState<IOrderView | null>(null);
  const [connected, setConnected] = useState(false);
  const orderRef = useRef<IOrderView | null>(null);

  const apply = useCallback((push: OrderPush) => {
    // Ignore a message about some other purchase; two running at once are two entries.
    if (orderRef.current && orderRef.current.orderId !== push.orderId && isOrderInFlight(orderRef.current.state)) {
      return;
    }
    const next = toView(push, orderRef.current);
    orderRef.current = next;
    setOrder(next);
  }, []);

  // One read on load, because push carries nothing from before the page existed.
  useEffect(() => {
    if (!tenantGroupId) return;
    let cancelled = false;

    billingService
      .getActiveOrder(tenantGroupId)
      .then((response) => {
        if (cancelled) return;
        orderRef.current = response.order;
        setOrder(response.order);
      })
      .catch(() => {
        // An order that cannot be read is not worth breaking the console over; the push will
        // still arrive, and the screen simply starts empty.
      });

    return () => {
      cancelled = true;
    };
  }, [tenantGroupId]);

  useEffect(() => {
    if (!tenantGroupId) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${(logicBaseUrl ?? "").replace(/\/$/, "")}${HUB_PATH}`)
      // Reconnects on its own; a dropped socket during a fifteen-minute job is ordinary.
      .withAutomaticReconnect()
      .build();

    connection.on(PROGRESS_METHOD, apply);
    connection.on(STATUS_METHOD, apply);
    connection.onreconnected(() => setConnected(true));
    connection.onclose(() => setConnected(false));

    connection
      .start()
      .then(() => setConnected(true))
      .catch(() => setConnected(false));

    return () => {
      connection.off(PROGRESS_METHOD, apply);
      connection.off(STATUS_METHOD, apply);
      void connection.stop();
    };
  }, [tenantGroupId, logicBaseUrl, apply]);

  return {
    order,
    /** Whether the live channel is up. The order is still correct when it is not. */
    connected,
    /** True while something is being built and the screen should show it. */
    isActive: order ? isOrderInFlight(order.state) : false,
  };
}
