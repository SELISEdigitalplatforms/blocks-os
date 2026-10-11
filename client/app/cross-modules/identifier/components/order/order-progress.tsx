import { useEffect, useState } from "react";
import { Check, CircleAlert, Loader2, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { IOrderView, isOrderInFlight, orderPercent } from "@blocks-identifier/models/billing.model";

/**
 * A purchase being built.
 *
 * Reports the step it is on and the time elapsed. It never predicts a finish: the work genuinely
 * varies, and a wrong estimate is worse than none.
 *
 * There is no failure state after payment. Once money has moved the customer is only ever shown
 * progress — a step taking another go, then "our team is looking at it", never a purchase that
 * failed. A decline happens before any charge, so nothing was created and nothing is owed.
 */

export type OrderTone = "good" | "neutral" | "warn" | "bad";

export interface OrderViewCopy {
  headline: string;
  subline: string;
  notice: string;
  tone: OrderTone;
  /** Progress bar and per-environment list are shown. */
  building: boolean;
}

/** The words for an order's state. Pure, so every branch is tested. */
export const describeOrder = (order: IOrderView, projectName?: string): OrderViewCopy => {
  const ready = order.environments.filter((e) => e.status === "ready").length;
  const total = order.environments.length;
  const exhausted =
    order.maxAttempts > 0 && order.attempt >= order.maxAttempts && order.state !== "created";
  const retrying = order.environments.some((e) => e.status === "retrying");
  const keepGoing =
    "You can close this page. Everything continues on our side, and we will email you the moment it is ready.";

  switch (order.state) {
    case "declined":
      return {
        headline: "Your card was declined",
        subline: "You have not been charged and nothing was created.",
        notice:
          "Your bank refused the payment. Try a different card — nothing on your account has changed.",
        tone: "bad",
        building: false,
      };
    case "expired":
      return {
        headline: "This checkout expired",
        subline: "Nothing was charged and nothing was created.",
        notice: "Open checkout again to see the current price.",
        tone: "neutral",
        building: false,
      };
    case "pending":
      return {
        headline: "Confirming your payment",
        subline: "Your bank is taking a moment to answer.",
        notice:
          "Nothing more to do. As soon as the payment is confirmed the environments start building.",
        tone: "neutral",
        building: false,
      };
    case "created":
      return {
        headline: projectName ? `${projectName} is ready` : "Your purchase is ready",
        subline:
          total > 0
            ? `All ${total} ${total === 1 ? "environment is" : "environments are"} live.`
            : "Everything is live.",
        notice: "Your allowances start now. The invoice is on its way by email.",
        tone: "good",
        building: true,
      };
    default:
      if (exhausted) {
        return {
          headline: "Still working on it",
          subline: "One environment is taking longer than the others.",
          notice:
            "This one is slower than usual and our team is now looking at it. Your payment is safe and your other environments are unaffected — we will email you when it is done.",
          tone: "warn",
          building: true,
        };
      }
      if (order.stepsDone === 0) {
        return {
          headline: "Payment received",
          subline: "We are building your environments now.",
          notice: keepGoing,
          tone: "good",
          building: true,
        };
      }
      return {
        headline: "Building your environments",
        subline: retrying
          ? "One step is taking a few goes."
          : `${ready} of ${total} ${total === 1 ? "is" : "are"} ready.`,
        notice: retrying
          ? "One step needed another attempt, which is normal. Nothing is lost and there is nothing for you to do."
          : keepGoing,
        tone: retrying ? "neutral" : "good",
        building: true,
      };
  }
};

/** "4:36", "1:02:10". Counts up from the charge; never a prediction. */
export const formatElapsed = (fromIso: string | null | undefined, to: number): string => {
  if (!fromIso) return "";
  const seconds = Math.max(0, Math.floor((to - new Date(fromIso).getTime()) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
};

const TONE_CLASS: Record<OrderTone, string> = {
  good: "border-emerald-200 bg-emerald-50 text-emerald-900",
  neutral: "border-border bg-muted/40 text-high-emphasis",
  // Amber, not red: a slow step is not a failure, and colouring it red would say otherwise.
  warn: "border-amber-200 bg-amber-50 text-amber-900",
  bad: "border-red-200 bg-red-50 text-red-900",
};

const STATUS_TONE: Record<string, string> = {
  ready: "bg-emerald-50 text-emerald-700",
  building: "bg-sky-50 text-sky-700",
  retrying: "bg-amber-50 text-amber-800",
  queued: "bg-muted text-medium-emphasis",
};

function Pips({ done, total, retrying }: { done: number; total: number; retrying: boolean }) {
  return (
    <div className="flex items-center gap-1" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={cn(
            "h-1.5 w-4 rounded-full",
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

const ToneIcon = ({ tone, done }: { tone: OrderTone; done: boolean }) => {
  const cls = "h-5 w-5";
  if (tone === "bad") return <CircleAlert className={cls} aria-hidden="true" />;
  if (done) return <Check className={cls} aria-hidden="true" />;
  if (tone === "warn") return <RotateCw className={cls} aria-hidden="true" />;
  return (
    <Loader2 className={cn(cls, "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
  );
};

interface OrderProgressProps {
  order: IOrderView;
  /** environment key → display label, from the catalogue. */
  labels?: Record<string, string>;
  projectName?: string;
}

export function OrderProgress({ order, labels = {}, projectName }: OrderProgressProps) {
  const copy = describeOrder(order, projectName);
  const finished = order.state === "created";
  const inFlight = isOrderInFlight(order.state);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!inFlight) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [inFlight]);

  const elapsed = formatElapsed(
    order.chargedAtUtc,
    finished && order.completedAtUtc ? new Date(order.completedAtUtc).getTime() : now,
  );
  const label = (env: string) => labels[env] ?? env;

  return (
    <section
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            copy.tone === "bad"
              ? "bg-red-50 text-red-700"
              : copy.tone === "warn"
                ? "bg-amber-50 text-amber-800"
                : "bg-emerald-50 text-emerald-700",
          )}
        >
          <ToneIcon tone={copy.tone} done={finished} />
        </span>
        <div>
          <h2 className="text-[17px] font-semibold text-high-emphasis">{copy.headline}</h2>
          <p className="text-[13px] text-medium-emphasis">{copy.subline}</p>
        </div>
      </div>

      {copy.building && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-4 text-[13px]">
            <span className="font-medium text-high-emphasis">
              {finished
                ? "All steps complete"
                : [label(order.currentEnvironment), order.currentStep]
                    .filter(Boolean)
                    .join(" — ") || "Starting…"}
            </span>
            <span className="font-mono text-[12px] text-medium-emphasis">
              {order.stepsDone} of {order.stepsTotal}
            </span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={orderPercent(order)}
            aria-label="Steps done"
          >
            <span
              className="block h-full rounded-full bg-primary transition-all"
              style={{ width: `${orderPercent(order)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11.5px] text-low-emphasis">
            <span>
              {finished ? "Finished" : "Reports the step it is on — never a guess at the finish."}
            </span>
            {elapsed && <span className="font-mono">{elapsed}</span>}
          </div>
        </div>
      )}

      <p className={cn("rounded-md border px-3 py-2 text-[12.5px]", TONE_CLASS[copy.tone])}>
        {copy.notice}
      </p>

      {copy.building && order.environments.length > 0 && (
        <div>
          <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-low-emphasis">
            Environments
          </div>
          <ul className="flex flex-col">
            {order.environments.map((environment) => (
              <li
                key={environment.tenantId || environment.environment}
                className="flex flex-col gap-1.5 border-b border-border py-2.5 last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <span className="flex-grow text-[13px] font-medium">
                    {label(environment.environment)}
                  </span>
                  {environment.attempt > 1 && (
                    <span className="font-mono text-[11px] text-amber-700">
                      attempt {environment.attempt} of {order.maxAttempts}
                    </span>
                  )}
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                      STATUS_TONE[environment.status] ?? STATUS_TONE.queued,
                    )}
                  >
                    {environment.status}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Pips
                    done={environment.stepsDone}
                    total={environment.stepsTotal}
                    retrying={environment.status === "retrying"}
                  />
                  <span className="text-[11.5px] text-medium-emphasis">
                    {environment.status === "ready"
                      ? "Done"
                      : environment.step || "Waiting its turn"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
