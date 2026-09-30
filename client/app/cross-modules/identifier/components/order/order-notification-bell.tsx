import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Progress } from "@/components/ui-kits/progress/progress";
import { cn } from "@/lib/utils";
import { IOrderView, orderPercent } from "@blocks-identifier/models/billing.model";

/**
 * One purchase, one notification, updated in place.
 *
 * Not one message per step: a project has forty-two of them, and appending each would bury
 * everything else the person has. The entry is keyed by order and replaced as progress arrives.
 *
 * Nothing here is ever red. A step being retried is not a failure, and after the charge the
 * customer is never told the purchase failed — only that it is still being set up.
 */

interface OrderNotificationBellProps {
  order: IOrderView | null;
  /** Whether the live channel is up. The order is still correct when it is not. */
  connected?: boolean;
  onOpenOrder?: (orderId: string) => void;
}

const HEADLINE: Record<string, string> = {
  pending: "Taking payment",
  paid: "Payment received",
  creating: "Creating your environments",
  created: "Your project is ready",
  declined: "Your card was declined",
  expired: "Checkout expired",
};

export function OrderNotificationBell({
  order,
  connected = true,
  onOpenOrder,
}: OrderNotificationBellProps) {
  const [open, setOpen] = useState(false);

  const active = order !== null && order.state !== "created" && order.state !== "declined";
  const percent = order ? orderPercent(order) : 0;
  const retrying = (order?.attempt ?? 0) > 0;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="icon"
        aria-label={active ? "Notifications, one in progress" : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="h-4 w-4" />
        {active && (
          <span
            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background bg-primary text-[10px] font-bold text-primary-foreground"
            aria-hidden="true"
          >
            1
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-border bg-popover p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">Notifications</span>
            {!connected && (
              // Worth saying, because the bar will not move until it reconnects.
              <span className="text-[11px] text-muted-foreground">reconnecting…</span>
            )}
          </div>

          {!order ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nothing in progress.</p>
          ) : (
            <div
              className={cn(
                "rounded-lg border p-3",
                retrying ? "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30" : "border-border",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium">{HEADLINE[order.state] ?? order.state}</span>
                {retrying && (
                  <Badge variant="secondary" className="whitespace-nowrap text-[10px]">
                    attempt {order.attempt} of {order.maxAttempts}
                  </Badge>
                )}
              </div>

              {active && (
                <div className="mt-2.5 flex flex-col gap-1.5">
                  <Progress value={percent} />
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-xs text-muted-foreground">
                      {[order.currentEnvironment, order.currentStep].filter(Boolean).join(" — ")}
                    </span>
                    <span className="whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">
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
                  onClick={() => onOpenOrder(order.orderId)}
                >
                  {order.state === "created" ? "Open the project" : "View details"}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
