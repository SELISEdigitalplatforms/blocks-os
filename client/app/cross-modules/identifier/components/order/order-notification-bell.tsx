import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { Progress } from "@/components/ui-kits/progress/progress";
import { cn } from "@/lib/utils";
import { IOrderView, isOrderInFlight, orderPercent } from "@blocks-identifier/models/billing.model";
import { describeOrder } from "./order-progress";

/**
 * One purchase, one notification, updated in place.
 *
 * Not one message per step: a project has forty-two of them, and appending each would bury
 * everything else the person has. Entries are keyed by order and replaced as progress arrives;
 * two purchases running together are two entries.
 *
 * A retry or a slow step is amber, never red — nothing has failed, and after the charge the
 * customer is never told it has.
 */

interface OrderNotificationBellProps {
  orders: IOrderView[];
  /** Whether the live channel is up. The orders are still correct when it is not. */
  connected?: boolean;
  onOpenOrder?: (order: IOrderView) => void;
}

export function OrderNotificationBell({
  orders,
  connected = true,
  onOpenOrder,
}: OrderNotificationBellProps) {
  const [open, setOpen] = useState(false);
  const active = orders.filter((o) => isOrderInFlight(o.state));
  // In-flight first, then the rest, newest-looking last.
  const sorted = [...active, ...orders.filter((o) => !isOrderInFlight(o.state))];

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="icon"
        aria-label={
          active.length > 0 ? `Notifications, ${active.length} in progress` : "Notifications"
        }
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="h-4 w-4" />
        {active.length > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-background bg-primary px-0.5 text-[10px] font-bold text-white"
            aria-hidden="true"
          >
            {active.length}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(380px,calc(100vw-2rem))] rounded-xl border border-border bg-popover p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">Notifications</span>
            {!connected && active.length > 0 && (
              // Worth saying, because the bars will not move until it reconnects.
              <span className="text-[11px] text-medium-emphasis">reconnecting…</span>
            )}
          </div>

          {sorted.length === 0 ? (
            <p className="py-6 text-center text-sm text-medium-emphasis">Nothing in progress.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {sorted.map((order) => {
                const copy = describeOrder(order);
                const inFlight = isOrderInFlight(order.state);
                return (
                  <li
                    key={order.orderId}
                    className={cn(
                      "rounded-lg border p-3",
                      copy.tone === "warn" ||
                        order.environments.some((e) => e.status === "retrying")
                        ? "border-amber-200 bg-amber-50/50"
                        : copy.tone === "bad"
                          ? "border-red-200 bg-red-50/50"
                          : "border-border",
                    )}
                  >
                    <div className="text-sm font-medium">{copy.headline}</div>
                    <div className="text-xs text-medium-emphasis">{copy.subline}</div>

                    {inFlight && order.stepsTotal > 0 && (
                      <div className="mt-2.5 flex flex-col gap-1.5">
                        <Progress value={orderPercent(order)} />
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-xs text-medium-emphasis">
                            {[order.currentEnvironment, order.currentStep]
                              .filter(Boolean)
                              .join(" — ")}
                          </span>
                          <span className="whitespace-nowrap font-mono text-[11px] text-medium-emphasis">
                            {order.stepsDone} of {order.stepsTotal}
                          </span>
                        </div>
                      </div>
                    )}

                    {onOpenOrder && (
                      <Button
                        variant="link"
                        size="sm"
                        className="mt-1 h-auto p-0 text-xs"
                        onClick={() => {
                          setOpen(false);
                          onOpenOrder(order);
                        }}
                      >
                        {order.state === "created" ? "Open the project" : "View details"}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
