import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router";
import { CreditCard, Download, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { Card } from "@/components/ui-kits/card/card";
import { Badge } from "@/components/ui-kits/badge/badge";
import { cn } from "@/lib/utils";
import { billingService } from "@blocks-identifier/services/billing.service";
import { useCards } from "@blocks-identifier/hooks/use-billing";
import { IInvoiceView, ISubscriptionView } from "@blocks-identifier/models/billing.model";
import { AddCardDialog } from "./add-card-dialog";

/**
 * What a project pays, what it has paid, and the card it pays with.
 *
 * Billing belongs to the project group, not to one environment and not to the person looking at
 * it: the same page is the same for every owner of the project.
 *
 * Past due is stated, never threatened. A failed charge carries to the next invoice and nothing is
 * suspended over it, so the page says what is owed rather than warning about losing access.
 */

const money = (market: string, amount: number) =>
  `${market} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const day = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—";

export function BillingPage() {
  const { tenantGroupId } = useParams();

  const { data: cards, loading: cardsLoading, reload: reloadCards, setDefault, remove } = useCards(tenantGroupId);

  const [subscription, setSubscription] = useState<ISubscriptionView | null>(null);
  const [invoices, setInvoices] = useState<IInvoiceView[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!tenantGroupId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [subscriptionResponse, invoiceResponse] = await Promise.all([
        billingService.getSubscription(tenantGroupId),
        billingService.getInvoices(tenantGroupId),
      ]);
      setSubscription(subscriptionResponse.subscription);
      setInvoices(invoiceResponse.invoices ?? []);
    } finally {
      setLoading(false);
    }
  }, [tenantGroupId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!tenantGroupId) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <p className="text-sm font-medium">No project selected</p>
          <p className="mt-1 text-sm text-muted-foreground">Billing belongs to a project. Open one to see it.</p>
        </Card>
      </div>
    );
  }

  const market = subscription?.market ?? "CHF";
  const pastDue = subscription?.state === "pastDue";

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
          <p className="text-sm text-muted-foreground">
            One charge a month for everything this project keeps running.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col gap-3 p-5 lg:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Next charge
          </span>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !subscription ? (
            <p className="text-sm text-muted-foreground">
              Nothing recurring yet. Add an environment and it will appear here.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="text-3xl font-bold tabular-nums tracking-tight">
                  {money(market, subscription.monthlyTotal + subscription.carriedBalance)}
                </span>
                <span className="text-sm text-muted-foreground">
                  on {day(subscription.nextChargeAtUtc)}
                </span>
                {pastDue && (
                  <Badge variant="secondary" className="bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    carried from last month
                  </Badge>
                )}
              </div>

              {subscription.carriedBalance > 0 && (
                <p className="text-sm text-muted-foreground">
                  {money(market, subscription.carriedBalance)} could not be collected last time and has been
                  added to this invoice. Nothing has been suspended.
                </p>
              )}

              <div className="mt-1 flex flex-col">
                {subscription.lines.map((line) => (
                  <div
                    key={`${line.environment}-${line.meter}`}
                    className="flex items-baseline justify-between border-b border-border py-2 text-sm last:border-b-0"
                  >
                    <span>
                      {line.label || line.environment}
                      {line.units > 0 && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {line.units.toLocaleString()} units
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums">{money(market, line.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Cards
            </span>
            <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add
            </Button>
          </div>

          {cardsLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !cards?.length ? (
            <p className="text-sm text-muted-foreground">
              No card on file. A renewal needs one, so add it before the next charge.
            </p>
          ) : (
            cards.map((card) => (
              <div key={card.paymentMethodId} className="flex items-center gap-3 border-b border-border py-2 last:border-b-0">
                <CreditCard className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-grow">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium tabular-nums">•••• {card.lastFour}</span>
                    {card.isDefault && <Badge variant="secondary" className="text-[10px]">default</Badge>}
                    {card.isExpired && (
                      <Badge variant="outline" className="border-amber-300 text-[10px] text-amber-700">
                        expired
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {card.brand} · expires {String(card.expiryMonth).padStart(2, "0")}/{card.expiryYear}
                  </span>
                </div>
                <div className="flex shrink-0 gap-1">
                  {!card.isDefault && (
                    <Button variant="ghost" size="sm" onClick={() => void setDefault(card.paymentMethodId)}>
                      Default
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => void remove(card.paymentMethodId)}>
                    Remove
                  </Button>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      <Card className="flex flex-col gap-2 p-5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Invoices</span>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing has been billed yet.</p>
        ) : (
          invoices.map((invoice) => (
            <div
              key={invoice.invoiceId}
              className="flex flex-wrap items-baseline gap-3 border-b border-border py-2.5 text-sm last:border-b-0"
            >
              <span className="font-medium tabular-nums">{invoice.number}</span>
              <span className="text-muted-foreground">{day(invoice.issuedAtUtc)}</span>
              {invoice.carriedIn > 0 && (
                <span className="text-xs text-muted-foreground">
                  includes {money(invoice.market, invoice.carriedIn)} carried
                </span>
              )}
              <span className="ml-auto tabular-nums">{money(invoice.market, invoice.total)}</span>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Download ${invoice.number}`}
                onClick={() =>
                  void billingService.downloadInvoice(tenantGroupId, invoice.invoiceId, invoice.number)
                }
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Badge
                variant="secondary"
                className={cn(
                  "text-[10px]",
                  invoice.state === "paid"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
                )}
              >
                {invoice.state}
              </Badge>
            </div>
          ))
        )}
      </Card>

      {subscription && subscription.state !== "cancelled" && (
        <Card className="flex flex-col gap-2 p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Subscription
          </span>
          <p className="text-sm text-muted-foreground">
            Unsubscribing stops the monthly charge. Your environments keep running and nothing is
            deleted — and anything already owed stays owed.
          </p>
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!window.confirm("Stop the monthly charge for this project?")) return;
                void billingService.unsubscribe(tenantGroupId).then(() => void load());
              }}
            >
              Unsubscribe
            </Button>
          </div>
        </Card>
      )}

      {subscription?.state === "cancelled" && (
        <Card className="p-5">
          <p className="text-sm font-medium">This project is no longer billed</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Environments are still running. Buy an environment or a top-up to start billing again.
          </p>
        </Card>
      )}

      <AddCardDialog
        tenantGroupId={tenantGroupId}
        market={market}
        open={adding}
        onOpenChange={setAdding}
        onCompleted={() => {
          // The card is filed from the provider's notification, which lands a moment after the
          // form closes — so re-read rather than assuming it is already there.
          window.setTimeout(() => void reloadCards(), 1500);
        }}
      />
    </div>
  );
}
