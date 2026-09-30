import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { Card } from "@/components/ui-kits/card/card";
import { Badge } from "@/components/ui-kits/badge/badge";
import { useParams, useSearchParams } from "react-router";
import { useUsage } from "@blocks-identifier/hooks/use-catalogue";
import { UsageMeters, MeterTopUp } from "@blocks-identifier/components/usage/usage-meters";
import { useCatalogue } from "@blocks-identifier/hooks/use-catalogue";
import { useCards, useCheckout } from "@blocks-identifier/hooks/use-billing";
import { IMeterUsage } from "@blocks-identifier/models/catalogue.model";
import { ITopUpSelection } from "@blocks-identifier/models/billing.model";
import { OrderProgress } from "@blocks-identifier/components/order/order-progress";

/**
 * What a project is using, environment by environment.
 *
 * Everything on the page comes from `/Usage`, which joins the project's rows with the published
 * catalogue. There is no list of services, meters or environments in this file: a meter published
 * into the catalogue and synced onto an environment appears here by itself.
 *
 * Scoped by project group, never by the caller's tenant. A project is the sum of its environments
 * and each one is shown on its own — nothing is pooled between them.
 *
 * Usage lives in the platform's root database, never inside the environment it describes, because
 * a ceiling is a billing record and an environment must not be able to rewrite its own.
 */
export function SubscriptionUsagePage() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const tenantGroupId = params.tenantGroupId ?? searchParams.get("tenantGroupId") ?? undefined;

  const { data: usage, loading, error, reload, sync } = useUsage(tenantGroupId);
  const { data: catalogue } = useCatalogue();
  const { data: cards } = useCards(tenantGroupId);
  const { quote, order, busy, priceOnly, start, pay } = useCheckout(tenantGroupId);

  /** Steps in the basket, keyed by environment and meter. */
  const [basket, setBasket] = useState<Record<string, number>>({});

  const selections: ITopUpSelection[] = useMemo(
    () =>
      Object.entries(basket)
        .filter(([, steps]) => steps > 0)
        .map(([key, steps]) => {
          const [environment, ...meterParts] = key.split("|");
          return { environment, meter: meterParts.join("|"), steps };
        }),
    [basket],
  );

  // Pricing writes nothing, so it can follow every change to the basket.
  useEffect(() => {
    if (!tenantGroupId || selections.length === 0) return;
    void priceOnly({ environments: [], topUps: selections });
  }, [tenantGroupId, selections, priceOnly]);

  // The order is written once the basket settles, so the idempotency key exists before Pay is
  // pressable rather than being minted by the press itself.
  useEffect(() => {
    if (!tenantGroupId || selections.length === 0) return;

    const settle = window.setTimeout(() => {
      void start({ environments: [], topUps: selections });
    }, 700);

    return () => window.clearTimeout(settle);
  }, [tenantGroupId, selections, start]);

  const defaultCard = cards?.find((card) => card.isDefault);
  const market = quote?.market ?? catalogue?.market ?? "CHF";

  /**
   * What a meter may be bought in, straight from the catalogue.
   *
   * There is no list of purchasable meters here: a meter the catalogue marks purchasable gets a
   * control, and one it does not simply has none.
   */
  const topUpFor = (environment: string, freeTier: boolean) => (meter: IMeterUsage): MeterTopUp | undefined => {
    const step = catalogue?.topUpSteps?.[meter.meter];
    if (!step) return undefined;

    const key = `${environment}|${meter.meter}`;

    return {
      step: step.step,
      price: step.price,
      billing: step.billing === "recurringWhileHeld" ? "rent" : "once",
      market,
      steps: basket[key] ?? 0,
      enabled: !freeTier,
      onChange: (steps) =>
        setBasket((current) => {
          const next = { ...current };
          if (steps <= 0) delete next[key];
          else next[key] = steps;
          return next;
        }),
    };
  };

  const onPay = async () => {
    const placed = await pay(defaultCard?.paymentMethodId);
    if (placed && placed.state !== "declined") {
      setBasket({});
      await reload();
    }
  };

  /** Brings every environment of the project in line with the catalogue. */
  const resync = async () => {
    if (!usage) return;
    for (const environment of usage.environments) {
      await sync(environment.tenantId, environment.environment, environment.periodKey);
    }
  };

  const notYetSeeded = usage?.environments.reduce(
    (total, environment) => total + (environment.notYetSeeded?.length ?? 0),
    0,
  ) ?? 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscription Usage</h1>
          <p className="text-sm text-muted-foreground">
            {usage
              ? `${usage.environments.length} environment${usage.environments.length === 1 ? "" : "s"} · catalogue ${usage.catalogueVersion || "—"}`
              : "Every limit is a hard stop. Nothing runs past it and nothing is billed as excess."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {notYetSeeded > 0 && <Badge variant="secondary">{notYetSeeded} not yet synced</Badge>}
          <Button variant="outline" size="sm" onClick={resync} disabled={!usage || loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync with catalogue
          </Button>
        </div>
      </div>

      {loading && (
        <Card className="p-6 text-sm text-muted-foreground">Loading usage…</Card>
      )}

      {error && !loading && (
        <Card className="border-destructive p-6">
          <p className="text-sm font-medium">Usage could not be loaded</p>
          <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
            Try again
          </Button>
        </Card>
      )}

      {!tenantGroupId && !loading && (
        <Card className="p-6">
          <p className="text-sm font-medium">No project selected</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Usage belongs to a project. Open one to see what it is using.
          </p>
        </Card>
      )}

      {usage && !loading && usage.environments.length === 0 && (
        <Card className="p-6">
          <p className="text-sm font-medium">This project has no environments yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add one to start metering, then sync it with the catalogue.
          </p>
        </Card>
      )}

      {order && order.state !== "declined" && <OrderProgress order={order} />}

      {selections.length > 0 && (
        <Card className="flex flex-col gap-2 p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Top-up basket
          </span>

          {quote?.lines.map((line) => (
            <div key={`${line.environment}-${line.meter}`} className="flex justify-between text-sm">
              <span>
                {line.label}
                <span className="ml-2 text-xs text-muted-foreground">
                  {line.environment} · +{line.units.toLocaleString()}
                  {line.billing === "rent" && " · monthly"}
                </span>
              </span>
              <span className="tabular-nums">
                {market} {line.amount.toFixed(2)}
              </span>
            </div>
          ))}

          {quote && (
            <>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>VAT</span>
                <span className="tabular-nums">
                  {market} {quote.vat.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 font-semibold">
                <span>Due now</span>
                <span className="tabular-nums">
                  {market} {quote.total.toFixed(2)}
                </span>
              </div>
            </>
          )}

          {!defaultCard && (
            <p className="text-xs text-destructive">
              No card on file. Add one on the billing page before buying.
            </p>
          )}

          <div className="flex gap-2">
            <Button
              disabled={!quote?.idempotencyKey || busy || !defaultCard}
              onClick={() => void onPay()}
            >
              {busy
                ? "Taking payment…"
                : quote?.idempotencyKey
                  ? `Pay ${market} ${quote.total.toFixed(2)}`
                  : "Preparing…"}
            </Button>
            <Button variant="outline" onClick={() => setBasket({})}>
              Clear
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Counter units are bought once and carry until spent. A resource ceiling is charged
            again every period it is held.
          </p>
        </Card>
      )}

      {usage &&
        !loading &&
        usage.environments.map((environment) => (
          <div key={environment.tenantId || environment.environment} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-base font-semibold tracking-tight">
                {environment.environment || "environment"}
              </h2>
              <span className="text-xs text-muted-foreground tabular-nums">
                period {environment.periodKey || "—"}
              </span>
            </div>

            {environment.services.length === 0 ? (
              <Card className="p-4 text-sm text-muted-foreground">
                Nothing is metered here yet — sync it with the catalogue.
              </Card>
            ) : (
              <UsageMeters
                usage={environment}
                topUpFor={topUpFor(environment.environment, environment.environment === "dev")}
              />
            )}
          </div>
        ))}
    </div>
  );
}
