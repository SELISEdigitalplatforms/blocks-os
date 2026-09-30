import { Card } from "@/components/ui-kits/card/card";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Progress } from "@/components/ui-kits/progress/progress";
import { cn } from "@/lib/utils";
import { IEnvironmentUsage, IMeterUsage } from "@blocks-identifier/models/catalogue.model";

/**
 * Renders whatever the catalogue defines.
 *
 * There is no list of services, no list of meters and no list of environments in this file. A meter
 * published into the catalogue and synced onto the environment shows up here by itself, including a
 * meter whose kind this build has never seen — an unknown kind is drawn as a plain value rather
 * than dropped.
 */

const formatUnits = (value: number, unit: string) => {
  if (value < 0) return "Unlimited";
  const formatted = value.toLocaleString();
  return unit ? `${formatted} ${unit}` : formatted;
};

/** Colour follows how close the meter is to its hard stop, not which meter it is. */
const severity = (percent: number) =>
  percent >= 90 ? "critical" : percent >= 70 ? "warning" : "normal";

const BAR_CLASS: Record<string, string> = {
  critical: "[&>div]:bg-destructive",
  warning: "[&>div]:bg-amber-500",
  normal: "",
};

/** How a meter may be topped up, and how many steps are already in the basket. */
export interface MeterTopUp {
  /** Units one step buys. Absent means this meter cannot be bought. */
  step?: number;
  price?: number | null;
  /** `once` carries until spent; `rent` is charged again every period it is held. */
  billing?: string;
  market?: string;
  steps: number;
  onChange: (steps: number) => void;
  /** False on a free-tier environment, where top-ups are not sold. */
  enabled: boolean;
}

/** Buttons that add or remove one purchasable step. Absent for anything not sold. */
function TopUpControl({ meter, topUp }: { meter: IMeterUsage; topUp: MeterTopUp }) {
  if (!topUp.enabled || !topUp.step) return null;

  const added = topUp.steps * topUp.step;

  return (
    <div className="mt-1.5 flex items-center gap-2">
      <div className="flex items-center overflow-hidden rounded-md border border-border">
        <button
          type="button"
          aria-label={`Remove a step of ${meter.label}`}
          className="h-6 w-6 text-sm leading-none disabled:opacity-30"
          disabled={topUp.steps === 0}
          onClick={() => topUp.onChange(topUp.steps - 1)}
        >
          −
        </button>
        <span className="min-w-14 px-1 text-center text-xs tabular-nums">
          {topUp.steps > 0 ? `+${added.toLocaleString()}` : "top up"}
        </span>
        <button
          type="button"
          aria-label={`Add a step of ${meter.label}`}
          className="h-6 w-6 text-sm leading-none"
          onClick={() => topUp.onChange(topUp.steps + 1)}
        >
          +
        </button>
      </div>

      <span className="text-[11px] text-muted-foreground">
        {topUp.step.toLocaleString()} {meter.unit || "units"}
        {typeof topUp.price === "number" && ` · ${topUp.market ?? "CHF"} ${topUp.price}`}
        {topUp.billing === "rent" && " per month"}
      </span>
    </div>
  );
}

function MeterRow({ meter, topUp }: { meter: IMeterUsage; topUp?: MeterTopUp }) {
  // A setting is not a quota: it has a value, not a ceiling to run out of.
  if (!meter.counts) {
    return (
      <div className="flex items-center justify-between gap-4 py-2">
        <span className="text-sm">{meter.label}</span>
        <span className="text-sm text-muted-foreground tabular-nums">
          {meter.included < 0 ? "Never" : formatUnits(meter.included, meter.unit)}
        </span>
      </div>
    );
  }

  const uncapped = meter.included < 0;
  const ceiling = uncapped ? -1 : meter.included + meter.purchased;
  const level = severity(meter.percentUsed);

  return (
    <div className="py-2">
      <div className="mb-1.5 flex items-baseline justify-between gap-4">
        <span className="flex items-center gap-2 text-sm">
          {meter.label}
          {meter.purchased > 0 && (
            // Bought outright: this part survives the period boundary.
            <Badge variant="secondary" className="text-[10px]">
              +{meter.purchased.toLocaleString()} bought
            </Badge>
          )}
          {!meter.inCatalogue && (
            <Badge variant="outline" className="text-[10px]">
              not in this catalogue
            </Badge>
          )}
        </span>
        <span
          className={cn(
            "text-xs tabular-nums",
            level === "critical" ? "text-destructive font-medium" : "text-muted-foreground",
          )}
        >
          {uncapped
            ? `${meter.used.toLocaleString()} · no cap`
            : `${meter.used.toLocaleString()} / ${ceiling.toLocaleString()}`}
        </span>
      </div>
      {!uncapped && (
        <Progress value={meter.percentUsed} className={cn("h-1.5", BAR_CLASS[level])} />
      )}
      {topUp && <TopUpControl meter={meter} topUp={topUp} />}
    </div>
  );
}

export function UsageMeters({
  usage,
  topUpFor,
}: {
  usage: IEnvironmentUsage;
  /** Supplies the top-up control for a meter. Omit it and the page stays read-only. */
  topUpFor?: (meter: IMeterUsage) => MeterTopUp | undefined;
}) {
  return (
    <div className="flex flex-col gap-4">
      {usage.notYetSeeded.length > 0 && (
        // The catalogue has moved on since this environment was provisioned.
        <Card className="border-amber-300 p-4 text-sm">
          <span className="font-medium">
            {usage.notYetSeeded.length} newly published meter
            {usage.notYetSeeded.length === 1 ? "" : "s"} not yet on this environment
          </span>
          <p className="mt-1 text-muted-foreground">
            {usage.notYetSeeded.join(", ")} — run a sync to create their rows.
          </p>
        </Card>
      )}

      {usage.services.map((service) => {
        const counted = service.meters.filter((m) => m.counts);
        const peak = counted.length
          ? Math.max(...counted.map((m) => m.percentUsed))
          : 0;

        return (
          <Card key={service.service} className="p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="font-medium">{service.label}</span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {service.meters.length} meter{service.meters.length === 1 ? "" : "s"}
                </span>
                {counted.length > 0 && (
                  <Badge
                    variant={peak >= 90 ? "destructive" : peak >= 70 ? "secondary" : "outline"}
                    className="text-[10px] tabular-nums"
                  >
                    peak {Math.round(peak)}%
                  </Badge>
                )}
              </span>
            </div>
            <div className="divide-y">
              {service.meters.map((meter) => (
                <MeterRow key={meter.meter} meter={meter} topUp={topUpFor?.(meter)} />
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
