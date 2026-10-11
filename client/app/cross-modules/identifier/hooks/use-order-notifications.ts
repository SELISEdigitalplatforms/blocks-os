import { useEffect, useMemo } from "react";
import * as signalR from "@microsoft/signalr";
import { create } from "zustand";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { billingService } from "@blocks-identifier/services/billing.service";
import { IOrderView, isOrderInFlight } from "@blocks-identifier/models/billing.model";

/**
 * The two channels behind one visible notification, as blocks-logic notification configurations
 * `subscription-order-progress` and `subscription-order-status` name their notify methods.
 *
 * Progress is transient: it moves a bar on a screen already open, and missing it costs nothing
 * because the status message says what happened. Persisting all forty-two step messages would
 * bury every other notification the person has.
 */
export const PROGRESS_METHOD = "SubscriptionOrderProgress";
export const STATUS_METHOD = "SubscriptionOrderStatus";

export interface OrderPush {
  orderId: string;
  tenantGroupId?: string;
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

/**
 * blocks-logic delivers `{ ..., denormalizedPayload: "<json>" }`, as a string or an object; the
 * order itself is the inner payload. A bare payload is accepted too. Anything else is ignored.
 */
export const parseOrderPush = (message: unknown): OrderPush | null => {
  try {
    const outer = typeof message === "string" ? JSON.parse(message) : message;
    if (!outer || typeof outer !== "object") return null;
    const inner = (outer as { denormalizedPayload?: unknown }).denormalizedPayload;
    const payload =
      inner === undefined ? outer : typeof inner === "string" ? JSON.parse(inner) : inner;
    if (
      !payload ||
      typeof payload !== "object" ||
      typeof (payload as OrderPush).orderId !== "string"
    ) {
      return null;
    }
    const push = payload as OrderPush;
    // The nested environment rows arrive PascalCase from the server's serializer.
    return {
      ...push,
      environments: (push.environments ?? []).map(camelKeys) as OrderPush["environments"],
    };
  } catch {
    return null;
  }
};

const camelKeys = (row: unknown) =>
  row && typeof row === "object"
    ? Object.fromEntries(
        Object.entries(row as Record<string, unknown>).map(([k, v]) => [
          k.charAt(0).toLowerCase() + k.slice(1),
          v,
        ]),
      )
    : row;

export const mergeOrderPush = (push: OrderPush, previous: IOrderView | undefined): IOrderView =>
  ({
    ...(previous ?? {
      total: 0,
      market: "",
      declineReason: "",
      chargedAtUtc: null,
      completedAtUtc: null,
    }),
    orderId: push.orderId,
    tenantGroupId: push.tenantGroupId ?? previous?.tenantGroupId,
    state: push.state,
    stepsDone: push.stepsDone,
    stepsTotal: push.stepsTotal,
    currentStep: push.currentStep,
    currentEnvironment: push.currentEnvironment,
    attempt: push.attempt,
    maxAttempts: push.maxAttempts,
    environments: push.environments ?? previous?.environments ?? [],
  }) as IOrderView;

interface OrderFeedState {
  /** orderId → latest view. One entry per purchase, replaced in place as pushes arrive. */
  orders: Record<string, IOrderView>;
  connected: boolean;
  upsert: (order: IOrderView) => void;
  apply: (push: OrderPush) => void;
  setConnected: (connected: boolean) => void;
}

export const useOrderFeed = create<OrderFeedState>((set) => ({
  orders: {},
  connected: false,
  upsert: (order) => set((s) => ({ orders: { ...s.orders, [order.orderId]: order } })),
  apply: (push) =>
    set((s) => ({
      orders: { ...s.orders, [push.orderId]: mergeOrderPush(push, s.orders[push.orderId]) },
    })),
  setConnected: (connected) => set({ connected }),
}));

/**
 * One socket for every screen that watches orders (the bell and the order page), opened while at
 * least one of them is mounted. Same hub and handshake as the genesis-os notification listener.
 */
let connection: signalR.HubConnection | null = null;
let users = 0;

const onMessage = (message: unknown) => {
  const push = parseOrderPush(message);
  if (push) useOrderFeed.getState().apply(push);
};

const acquire = () => {
  users += 1;
  if (connection) return;
  const logic = getRuntimeEnv("BLOCKS_LOGIC_BASE_URL").trim().replace(/\/$/, "");
  // No hub configured: stay on the one read. The screens still show the order, without live steps.
  if (!/^https?:\/\//.test(logic)) {
    useOrderFeed.getState().setConnected(false);
    return;
  }
  const key = encodeURIComponent(getRuntimeEnv("BLOCKS_X_BLOCKS_KEY"));
  connection = new signalR.HubConnectionBuilder()
    .withUrl(`${logic}/api/NotificationHub?x-blocks-key=${key}`, {
      transport: signalR.HttpTransportType.WebSockets,
    })
    // Reconnects on its own; a dropped socket during a fifteen-minute job is ordinary.
    .withAutomaticReconnect()
    .build();
  connection.on(PROGRESS_METHOD, onMessage);
  connection.on(STATUS_METHOD, onMessage);
  connection.onreconnected(() => useOrderFeed.getState().setConnected(true));
  connection.onreconnecting(() => useOrderFeed.getState().setConnected(false));
  connection.onclose(() => useOrderFeed.getState().setConnected(false));
  connection
    .start()
    .then(() => useOrderFeed.getState().setConnected(true))
    .catch(() => useOrderFeed.getState().setConnected(false));
};

const release = () => {
  users = Math.max(0, users - 1);
  if (users > 0 || !connection) return;
  const closing = connection;
  connection = null;
  closing.off(PROGRESS_METHOD, onMessage);
  closing.off(STATUS_METHOD, onMessage);
  void closing.stop();
};

/**
 * Watches a project's purchases.
 *
 * Push, not polling: the worker sends each step as it finishes. A reload loses the transient
 * progress, so this reads once on load — the named order when the page was opened for one, else
 * the project's unfinished order — and then listens. One request, not a poll.
 */
export function useOrderNotifications(tenantGroupId: string | undefined, orderId?: string | null) {
  const orders = useOrderFeed((s) => s.orders);
  const connected = useOrderFeed((s) => s.connected);

  useEffect(() => {
    if (!tenantGroupId) return;
    let cancelled = false;
    const read = orderId
      ? billingService.getOrder(tenantGroupId, orderId)
      : billingService.getActiveOrder(tenantGroupId);
    read
      .then((response) => {
        if (!cancelled && response?.order) {
          useOrderFeed
            .getState()
            .upsert({
              ...response.order,
              tenantGroupId: response.order.tenantGroupId ?? tenantGroupId,
            });
        }
      })
      .catch(() => {
        // An order that cannot be read is not worth breaking the console over; the push still
        // arrives, and the screen simply starts empty.
      });
    return () => {
      cancelled = true;
    };
  }, [tenantGroupId, orderId]);

  useEffect(() => {
    if (!tenantGroupId) return;
    acquire();
    return release;
  }, [tenantGroupId]);

  // Pushes go to the user, not the project; keep this project's orders (and any whose project
  // the server did not say).
  const list = useMemo(
    () =>
      Object.values(orders).filter(
        (o) => !o.tenantGroupId || !tenantGroupId || o.tenantGroupId === tenantGroupId,
      ),
    [orders, tenantGroupId],
  );
  const inFlight = list.filter((o) => isOrderInFlight(o.state));
  const order = (orderId ? orders[orderId] : undefined) ?? inFlight[0] ?? null;

  return {
    /** The order this screen is about: the named one, else the first unfinished one. */
    order,
    /** Every purchase seen this session, newest pushes replacing older ones. */
    orders: list,
    /** Whether the live channel is up. The order is still correct when it is not. */
    connected,
    /** True while something is being built and the screen should show it. */
    isActive: inFlight.length > 0,
  };
}
