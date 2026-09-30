import { Card } from "@/components/ui-kits/card/card";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Progress } from "@/components/ui-kits/progress/progress";
import { cn } from "@/lib/utils";
import { IOrderView, orderPercent } from "@blocks-identifier/models/billing.model";

/**
 * A purchase being built.
 *
 * Reports the step it is on and how many are done. It does not predict a finish time: the work
 * genuinely varies, and a wrong estimate is worse than none.
 *
 * There is no failure state here. Once money has moved the customer is only ever shown progress —
 * a step taking another go, never a purchase that failed. A decline happens before any charge and
 * is handled by the checkout screen instead.
 */

const STATUS_TONE: Record<string, string> = {
  ready: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  building: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  // Amber, not red: a retry is not a failure, and colouring it red would say otherwise.
  retrying: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  queued: "bg-muted text-muted-foreground",
};

function Pips({ done, total, retrying }: { done: number; total: number; retrying: boolean }) {
  return (
    <div className="flex items-center gap-1" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={cn(
            "h-1 w-4 rounded-full",
            index < done
              ? "bg-emerald-600"
              : retrying && index === done
                ? "bg-amber-500"
                : index === done
                  ? "bg-sky-600"
                  : "bg-muted",
          )}
        />
      ))}
    </div>
  );
}

export function OrderProgress({ order }: { order: IOrderView }) {
  const percent = orderPercent(order);
  const finished = order.state === "created";

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-base font-semibold tracking-tight">
            {finished ? "Your project is ready" : "Payment received"}
          </p>
          <p className="text-sm text-muted-foreground">
            {finished
              ? "All environments are live."
              : "We are building your environments. You can close this page — we will email you."}
          </p>
        </div>
        {order.attempt > 0 && (
          <Badge variant="secondary" className="whitespace-nowrap">
            attempt {order.attempt} of {order.maxAttempts}
          </Badge>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm font-medium">
            {finished
              ? "All steps complete"
              : [order.currentEnvironment, order.currentStep].filter(Boolean).join(" — ")}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {order.stepsDone} of {order.stepsTotal} steps
          </span>
        </div>
        <Progress value={percent} />
      </div>

      <div className="flex flex-col">
        {order.environments.map((environment) => (
          <div
            key={environment.tenantId || environment.environment}
            className="flex flex-col gap-1.5 border-b border-border py-2.5 last:border-b-0"
          >
            <div className="flex items-center gap-3">
              <span className="flex-grow text-sm font-medium">{environment.environment}</span>
              {environment.attempt > 0 && (
                <span className="text-xs tabular-nums text-amber-700 dark:text-amber-400">
                  attempt {environment.attempt} of {order.maxAttempts}
                </span>
              )}
              <Badge
                variant="outline"
                className={cn("border-transparent text-[10px] uppercase", STATUS_TONE[environment.status])}
              >
                {environment.status}
              </Badge>
            </div>
            <div className="flex items-center gap-2 pl-0.5">
              <Pips
                done={environment.stepsDone}
                total={environment.stepsTotal}
                retrying={environment.status === "retrying"}
              />
              <span className="text-xs text-muted-foreground">
                {environment.status === "ready" ? "Done" : environment.step || "Waiting its turn"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
