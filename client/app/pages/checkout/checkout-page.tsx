import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui-kits/button/button";
import { Card } from "@/components/ui-kits/card/card";
import { Badge } from "@/components/ui-kits/badge/badge";
import { cn } from "@/lib/utils";
import { useEnvironmentOptions } from "@blocks-identifier/hooks/use-catalogue";
import { useCards, useCheckout } from "@blocks-identifier/hooks/use-billing";

/**
 * Buying environments for a project.
 *
 * The quote is fetched when the screen opens, not when Pay is pressed — that is what mints the
 * idempotency key, and a key minted on the press would give a double-click two keys and two
 * charges.
 *
 * Pressing Pay charges and returns immediately. Building the environments takes minutes and
 * happens afterwards, which is why this hands over to the order screen rather than waiting.
 */
const money = (market: string, amount: number) =>
  `${market} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function CheckoutPage() {
  const { tenantGroupId } = useParams();
  const navigate = useNavigate();

  const { options, loading: catalogueLoading } = useEnvironmentOptions();
  const { data: cards } = useCards(tenantGroupId);
  const { quote, busy, error, priceOnly, start, pay } = useCheckout(tenantGroupId);

  const [selected, setSelected] = useState<string[]>([]);

  const market = quote?.market ?? "CHF";
  const defaultCard = useMemo(() => cards?.find((card) => card.isDefault), [cards]);

  // Price on every change — this writes nothing. Creating an order here instead would leave one
  // abandoned behind every tick of a checkbox.
  useEffect(() => {
    if (!tenantGroupId || selected.length === 0) return;
    void priceOnly({ environments: selected, topUps: [] });
  }, [tenantGroupId, selected, priceOnly]);

  // Write the order once the selection has settled, so the key exists before Pay can be pressed
  // and not at the press, where a double-click would mint two of them. Re-running reuses this
  // session's order rather than starting another.
  useEffect(() => {
    if (!tenantGroupId || selected.length === 0) return;

    const settle = window.setTimeout(() => {
      void start({ environments: selected, topUps: [] });
    }, 700);

    return () => window.clearTimeout(settle);
  }, [tenantGroupId, selected, start]);

  const toggle = (value: string) =>
    setSelected((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );

  const onPay = async () => {
    const order = await pay(defaultCard?.paymentMethodId);
    if (order && order.state !== "declined") {
      navigate(`/project/${tenantGroupId}/order`);
    }
  };

  if (!tenantGroupId) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <p className="text-sm font-medium">No project selected</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add environments</h1>
        <p className="text-sm text-muted-foreground">
          A project is the sum of its environments. Each is priced on its own and nothing is shared
          between them.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-3 lg:col-span-2">
          {catalogueLoading ? (
            <Card className="p-6 text-sm text-muted-foreground">Loading the catalogue…</Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {options.map((option) => {
                const on = selected.includes(option.value);
                const free = option.freeTierAvailable && option.freePrice === 0;

                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(option.value)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-colors",
                      on ? "border-primary ring-1 ring-primary" : "border-border hover:border-muted-foreground/40",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">{option.label}</span>
                      {free ? (
                        <Badge variant="secondary" className="text-[10px]">free tier</Badge>
                      ) : (
                        <span className="text-sm font-medium tabular-nums">
                          {option.price === null ? "—" : money(market, option.price)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {option.topUpUncapped ? "Top-ups uncapped" : "Top-ups to 2× included"}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <Card className="flex h-fit flex-col gap-3 p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Summary
          </span>

          {selected.length === 0 ? (
            <p className="text-sm text-muted-foreground">Pick an environment to see the price.</p>
          ) : !quote ? (
            <p className="text-sm text-muted-foreground">Pricing…</p>
          ) : (
            <>
              {quote.lines.map((line) => (
                <div key={`${line.environment}-${line.meter}`} className="flex justify-between text-sm">
                  <span>{line.label}</span>
                  <span className="tabular-nums">{money(quote.market, line.amount)}</span>
                </div>
              ))}

              <div className="flex justify-between text-sm text-muted-foreground">
                <span>VAT</span>
                <span className="tabular-nums">{money(quote.market, quote.vat)}</span>
              </div>

              <div className="flex justify-between border-t border-border pt-2 font-semibold">
                <span>Due today</span>
                <span className="tabular-nums">{money(quote.market, quote.total)}</span>
              </div>

              <p className="text-xs text-muted-foreground">
                Then {money(quote.market, quote.recurringMonthly)} a month.
              </p>
            </>
          )}

          {defaultCard ? (
            <p className="text-xs text-muted-foreground">
              Charging {defaultCard.brand} •••• {defaultCard.lastFour}
            </p>
          ) : (
            <p className="text-xs text-destructive">
              No card on file. Add one on the billing page first.
            </p>
          )}

          {error && <p className="text-xs text-destructive">{error.message}</p>}

          <Button
            className="w-full"
            disabled={!quote?.idempotencyKey || busy || !defaultCard}
            onClick={() => void onPay()}
          >
            {busy
              ? "Taking payment…"
              : !quote
                ? "Pay"
                : !quote.idempotencyKey
                  ? "Preparing…"
                  : `Pay ${money(quote.market, quote.total)}`}
          </Button>

          <p className="text-center text-[11px] text-muted-foreground">
            Your environments are built after the payment clears.
          </p>
        </Card>
      </div>
    </div>
  );
}
