import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ChevronRight, CircleAlert, CreditCard, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { billingService } from "@blocks-identifier/services/billing.service";
import { useCards } from "@blocks-identifier/hooks/use-billing";
import {
  IInvoiceView,
  ISubscriptionView,
  billingReasonMessage,
  billingRefusal,
} from "@blocks-identifier/models/billing.model";
import {
  KindChip,
  LoadError,
  LoadingRows,
  SectionTitle,
  StatusChip,
  day,
  errorText,
  kindTotals,
  money,
  period,
  touch,
} from "./billing-ui";

/**
 * What a project pays, what it has paid, and the card it pays with.
 *
 * Billing belongs to the project (tenant group), not to one environment and not to the person
 * looking at it: the same page is the same for every owner of the project. Decided 2026-10-11 —
 * the design draws it at account level, the product keeps it per project.
 *
 * Past due is stated, never threatened. A failed charge carries to the next invoice and nothing is
 * suspended over it, so the page says what is owed rather than warning about losing access.
 */

const primaryButton = cn(
  touch,
  "inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50",
);
const outlineButton = cn(
  touch,
  "inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium text-high-emphasis hover:bg-accent disabled:opacity-50",
);

type BillingLoad =
  { subscription: ISubscriptionView | null; invoices: IInvoiceView[] } | { error: string };

/** Reads the subscription and invoices. Never throws: a failure comes back as `error`. */
const fetchBilling = async (tenantGroupId: string): Promise<BillingLoad> => {
  try {
    const [subscriptionResponse, invoiceResponse] = await Promise.all([
      billingService.getSubscription(tenantGroupId),
      billingService.getInvoices(tenantGroupId),
    ]);
    const refusal = billingRefusal(subscriptionResponse ?? {});
    if (refusal) return { error: billingReasonMessage(refusal) };
    return {
      subscription: subscriptionResponse?.subscription ?? null,
      invoices: invoiceResponse?.invoices ?? [],
    };
  } catch (error) {
    return { error: errorText(error, "Billing could not be loaded.") };
  }
};

export function BillingPage() {
  const { tenantGroupId } = useParams();
  const { data: cards, loading: cardsLoading, error: cardsError } = useCards(tenantGroupId);

  const [subscription, setSubscription] = useState<ISubscriptionView | null>(null);
  const [invoices, setInvoices] = useState<IInvoiceView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [paying, setPaying] = useState(false);
  const [payMessage, setPayMessage] = useState<string | null>(null);

  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<{ id: string; message: string } | null>(null);

  const [confirmingUnsubscribe, setConfirmingUnsubscribe] = useState(false);
  const [unsubscribing, setUnsubscribing] = useState(false);
  const [unsubscribeMessage, setUnsubscribeMessage] = useState<string | null>(null);

  const apply = useCallback((result: BillingLoad) => {
    if ("error" in result) {
      setLoadError(result.error);
    } else {
      setSubscription(result.subscription);
      setInvoices(result.invoices);
    }
    setLoading(false);
  }, []);

  /** Re-read after an action or a Try again. */
  const load = useCallback(async () => {
    if (!tenantGroupId) return;
    setLoading(true);
    setLoadError(null);
    apply(await fetchBilling(tenantGroupId));
  }, [tenantGroupId, apply]);

  useEffect(() => {
    if (!tenantGroupId) return;
    let cancelled = false;
    void fetchBilling(tenantGroupId).then((result) => {
      if (!cancelled) apply(result);
    });
    return () => {
      cancelled = true;
    };
  }, [tenantGroupId, apply]);

  if (!tenantGroupId) {
    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm font-medium text-high-emphasis">No project selected</p>
          <p className="mt-1 text-sm text-medium-emphasis">
            Billing belongs to a project. Open one to see it.
          </p>
        </div>
      </div>
    );
  }

  const market = subscription?.market ?? invoices[0]?.market ?? "CHF";
  const pastDue = subscription?.state === "pastDue";
  const unpaidTotal = invoices
    .filter((invoice) => invoice.state !== "paid")
    .reduce((sum, invoice) => sum + invoice.total, 0);
  const owed =
    subscription && subscription.carriedBalance > 0 ? subscription.carriedBalance : unpaidTotal;

  const payNow = async () => {
    setPaying(true);
    setPayMessage(null);
    try {
      const response = await billingService.retryPayment(tenantGroupId);
      const refusal = billingRefusal(response ?? {});
      if (refusal) {
        setPayMessage(billingReasonMessage(refusal));
        return;
      }
      await load();
    } catch (error) {
      setPayMessage(errorText(error, "The payment could not be started. Try again in a moment."));
    } finally {
      setPaying(false);
    }
  };

  const download = async (invoice: IInvoiceView) => {
    setDownloading(invoice.invoiceId);
    setDownloadError(null);
    try {
      await billingService.downloadInvoice(tenantGroupId, invoice.invoiceId, invoice.number);
    } catch (error) {
      setDownloadError({
        id: invoice.invoiceId,
        message: errorText(error, "The invoice could not be downloaded."),
      });
    } finally {
      setDownloading(null);
    }
  };

  const unsubscribe = async () => {
    setUnsubscribing(true);
    setUnsubscribeMessage(null);
    try {
      const response = (await billingService.unsubscribe(tenantGroupId)) as {
        outstandingBalance?: number;
        isSuccess?: boolean;
        errors?: Record<string, string>;
      };
      const refusal = billingRefusal(response ?? {});
      if (refusal) {
        setUnsubscribeMessage(billingReasonMessage(refusal));
        return;
      }
      setConfirmingUnsubscribe(false);
      const outstanding = response?.outstandingBalance ?? 0;
      setUnsubscribeMessage(
        outstanding > 0
          ? `The monthly charge has stopped. ${money(market, outstanding)} is still owed.`
          : "The monthly charge has stopped.",
      );
      await load();
    } catch (error) {
      setUnsubscribeMessage(errorText(error, "Unsubscribing did not work. Try again."));
    } finally {
      setUnsubscribing(false);
    }
  };

  const defaultCard = cards?.find((card) => card.isDefault) ?? null;

  return (
    <div className="flex flex-col gap-5 p-4 sm:gap-6 sm:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-high-emphasis">Billing</h1>
        <p className="text-sm text-medium-emphasis">
          One charge a month for everything this project keeps running.
        </p>
      </header>

      {loadError ? (
        <LoadError message={loadError} onRetry={() => void load()} />
      ) : (
        <>
          {!loading && pastDue && (
            <section
              aria-label="Payment owed"
              className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 sm:flex-row sm:items-start"
            >
              <CircleAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
              <div className="flex flex-1 flex-col gap-1">
                <p className="text-sm font-semibold">
                  The last charge for this project did not go through
                </p>
                <p className="text-sm">
                  {owed > 0 ? `${money(market, owed)} is owed. ` : ""}It is carried to the next
                  invoice and retried. Nothing has been stopped: every environment keeps running.
                </p>
                {payMessage && (
                  <p className="text-sm font-medium" role="status">
                    {payMessage}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to="cards" className={outlineButton}>
                  Manage cards
                </Link>
                <button
                  type="button"
                  className={primaryButton}
                  onClick={() => void payNow()}
                  disabled={paying}
                >
                  {paying && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  Pay now
                </button>
              </div>
            </section>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <section
              aria-label="Next charge"
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:p-5 lg:col-span-2"
            >
              <SectionTitle>Next charge</SectionTitle>

              {loading ? (
                <LoadingRows label="Loading the next charge" />
              ) : !subscription ? (
                <p className="text-sm text-medium-emphasis">
                  Nothing recurring on this project yet. Add an environment and it will appear here.
                </p>
              ) : subscription.state === "cancelled" ? (
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-high-emphasis">
                    This project is no longer billed
                  </p>
                  <p className="text-sm text-medium-emphasis">
                    Its environments are still running. Buy an environment or a top-up to start
                    billing again.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-mono text-3xl font-bold tracking-tight text-high-emphasis">
                      {money(market, subscription.monthlyTotal + subscription.carriedBalance)}
                    </span>
                    <span className="text-sm text-medium-emphasis">
                      on {day(subscription.nextChargeAtUtc)}
                    </span>
                  </div>

                  {subscription.carriedBalance > 0 && (
                    <p className="text-sm text-medium-emphasis">
                      Includes{" "}
                      <span className="font-mono">
                        {money(market, subscription.carriedBalance)}
                      </span>{" "}
                      that could not be collected last time. Nothing has been suspended.
                    </p>
                  )}

                  {subscription.lines.length === 0 ? (
                    <p className="text-sm text-medium-emphasis">No recurring lines.</p>
                  ) : (
                    <ul className="flex flex-col" aria-label="Subscription lines">
                      {subscription.lines.map((line) => (
                        <li
                          key={`${line.environment}-${line.meter}`}
                          className="flex flex-col gap-1 border-b border-border py-2.5 text-sm last:border-b-0 sm:flex-row sm:items-center sm:gap-3"
                        >
                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                            <KindChip billing={line.billing ?? "rent"} />
                            <span className="text-high-emphasis">
                              {line.label || line.environment}
                            </span>
                            <span className="font-mono text-xs text-low-emphasis">
                              {line.environment}
                              {line.units > 0 && ` · ${line.units.toLocaleString("en-US")} units`}
                            </span>
                            {line.pendingRemoval && (
                              <span className="rounded bg-warning-100 px-1.5 py-0.5 text-[11px] font-medium text-warning-800">
                                ends {day(line.endsAtUtc)}
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-high-emphasis sm:text-right">
                            {line.amount === 0 ? "Free" : money(market, line.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </section>

            <section
              aria-label="Cards"
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:p-5"
            >
              <SectionTitle
                aside={
                  cards && cards.length > 0
                    ? `${cards.length} ${cards.length === 1 ? "card" : "cards"}`
                    : undefined
                }
              >
                Cards
              </SectionTitle>

              {cardsLoading ? (
                <LoadingRows rows={1} label="Loading cards" />
              ) : cardsError ? (
                <p className="text-sm text-red-700">The cards could not be loaded.</p>
              ) : !defaultCard ? (
                <p className="text-sm text-medium-emphasis">
                  No default card on file. A renewal needs one, so add it before the next charge.
                </p>
              ) : (
                <div className="flex items-center gap-3">
                  <CreditCard
                    className="h-5 w-5 shrink-0 text-medium-emphasis"
                    aria-hidden="true"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-high-emphasis">
                      {defaultCard.brand}{" "}
                      <span className="font-mono">•••• {defaultCard.lastFour}</span>
                    </span>
                    <span className="font-mono text-xs text-medium-emphasis">
                      expires {String(defaultCard.expiryMonth).padStart(2, "0")}/
                      {defaultCard.expiryYear}
                      {defaultCard.isExpired && (
                        <span className="ml-2 font-sans font-semibold text-warning-800">
                          expired
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              )}

              <Link
                to="cards"
                className={cn(
                  touch,
                  "mt-auto inline-flex items-center gap-1 self-start text-sm font-medium text-primary hover:underline",
                )}
              >
                Manage cards
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </section>
          </div>

          <section
            aria-label="Invoices"
            className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 sm:p-5"
          >
            <SectionTitle
              aside={!loading && invoices.length > 0 ? `${invoices.length} issued` : undefined}
            >
              Invoices
            </SectionTitle>

            {loading ? (
              <LoadingRows label="Loading invoices" />
            ) : invoices.length === 0 ? (
              <p className="text-sm text-medium-emphasis">
                Nothing has been billed on this project yet.
              </p>
            ) : (
              <>
                <div
                  className="hidden grid-cols-[1.3fr_1.4fr_1.6fr_1fr_auto_auto] gap-3 border-b border-border pb-2 text-[11px] font-semibold uppercase tracking-wider text-low-emphasis md:grid"
                  aria-hidden="true"
                >
                  <span>Invoice</span>
                  <span>Period</span>
                  <span>Lines</span>
                  <span className="text-right">Total</span>
                  <span>Status</span>
                  <span className="w-11" />
                </div>
                <ul className="flex flex-col">
                  {invoices.map((invoice) => {
                    const totals = kindTotals(invoice);
                    return (
                      <li
                        key={invoice.invoiceId}
                        className="flex flex-col gap-1.5 border-b border-border py-3 text-sm last:border-b-0 md:grid md:grid-cols-[1.3fr_1.4fr_1.6fr_1fr_auto_auto] md:items-center md:gap-3"
                      >
                        <div className="flex flex-col">
                          <Link
                            to={`invoices/${encodeURIComponent(invoice.invoiceId)}`}
                            className="font-mono font-medium text-primary hover:underline"
                          >
                            {invoice.number}
                          </Link>
                          <span className="text-xs text-medium-emphasis">
                            issued {day(invoice.issuedAtUtc)}
                          </span>
                        </div>
                        <span className="text-xs text-medium-emphasis md:text-sm">
                          {period(invoice.periodStartUtc, invoice.periodEndUtc)}
                        </span>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          {totals && totals.recurring > 0 && (
                            <span className="flex items-center gap-1.5">
                              <KindChip billing="rent" />
                              <span className="font-mono">
                                {money(invoice.market, totals.recurring)}
                              </span>
                            </span>
                          )}
                          {totals && totals.oneOff > 0 && (
                            <span className="flex items-center gap-1.5">
                              <KindChip billing="once" />
                              <span className="font-mono">
                                {money(invoice.market, totals.oneOff)}
                              </span>
                            </span>
                          )}
                          {invoice.carriedIn > 0 && (
                            <span className="text-medium-emphasis">
                              + {money(invoice.market, invoice.carriedIn)} carried
                            </span>
                          )}
                        </div>
                        <span className="font-mono font-medium text-high-emphasis md:text-right">
                          {money(invoice.market, invoice.total)}
                        </span>
                        <span>
                          <StatusChip invoice={invoice} />
                        </span>
                        <button
                          type="button"
                          aria-label={`Download PDF of ${invoice.number}`}
                          onClick={() => void download(invoice)}
                          disabled={downloading === invoice.invoiceId}
                          className="inline-flex h-11 w-11 items-center justify-center self-start rounded-md text-medium-emphasis hover:bg-accent hover:text-high-emphasis disabled:opacity-50 md:self-auto"
                        >
                          {downloading === invoice.invoiceId ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Download className="h-4 w-4" aria-hidden="true" />
                          )}
                        </button>
                        {downloadError?.id === invoice.invoiceId && (
                          <p role="alert" className="text-xs text-red-700 md:col-span-6">
                            {downloadError.message}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>

          {!loading && subscription && subscription.state !== "cancelled" && (
            <section
              aria-label="Subscription"
              className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 sm:p-5"
            >
              <SectionTitle>Subscription</SectionTitle>
              <p className="text-sm text-medium-emphasis">
                Unsubscribing stops the monthly charge for this project. Its environments keep
                running and nothing is deleted. Anything already owed stays owed.
              </p>
              <div>
                <button
                  type="button"
                  className={outlineButton}
                  onClick={() => {
                    setUnsubscribeMessage(null);
                    setConfirmingUnsubscribe(true);
                  }}
                >
                  Unsubscribe
                </button>
              </div>
            </section>
          )}

          {unsubscribeMessage && !confirmingUnsubscribe && (
            <p role="status" className="text-sm text-medium-emphasis">
              {unsubscribeMessage}
            </p>
          )}
        </>
      )}

      <Dialog
        open={confirmingUnsubscribe}
        onOpenChange={(open) => {
          if (!unsubscribing) setConfirmingUnsubscribe(open);
        }}
      >
        {confirmingUnsubscribe && (
          <ConfirmationModal
            data={{
              dialogTitle: "Stop the monthly charge for this project?",
              dialogSubtitle: (
                <>
                  The environments keep running and nothing is deleted. Anything already owed stays
                  owed.
                  {unsubscribeMessage && (
                    <span role="alert" className="mt-2 block text-red-700">
                      {unsubscribeMessage}
                    </span>
                  )}
                </>
              ),
              confirmButton: unsubscribing ? "Stopping…" : "Unsubscribe",
              cancelButton: "Keep it",
            }}
            onCancel={() => setConfirmingUnsubscribe(false)}
            onConfirm={() => void unsubscribe()}
            buttonState={{ confirm: { disable: unsubscribing } }}
          />
        )}
      </Dialog>
    </div>
  );
}
