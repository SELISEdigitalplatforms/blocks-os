import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ChevronLeft, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { billingService } from "@blocks-identifier/services/billing.service";
import {
  IInvoiceView,
  billingReasonMessage,
  billingRefusal,
} from "@blocks-identifier/models/billing.model";
import {
  KindChip,
  LoadError,
  LoadingRows,
  StatusChip,
  day,
  errorText,
  invoiceStatus,
  money,
  period,
  touch,
} from "./billing-ui";

/**
 * One invoice of one project.
 *
 * Route: /app/project/:tenantGroupId/billing/invoices/:invoiceId. The project comes from the route
 * and is sent with the request; the server refuses an invoice that is not this project's, which
 * reads here as "not found".
 *
 * A failed payment is amber, not red: the amount is carried and retried, nothing is suspended.
 */

const NOT_FOUND = "billing_invoice_not_found";

const outlineButton = cn(
  touch,
  "inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium text-high-emphasis hover:bg-accent disabled:opacity-50",
);
const primaryButton = cn(
  touch,
  "inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50",
);

type LoadState =
  | { kind: "loading" }
  | { kind: "notFound" }
  | { kind: "error"; message: string }
  | { kind: "ready"; invoice: IInvoiceView };

/** Reads one invoice. Never throws: every outcome is a state the page can draw. */
const fetchInvoice = async (
  tenantGroupId: string | undefined,
  invoiceId: string | undefined,
): Promise<LoadState> => {
  if (!tenantGroupId || !invoiceId) return { kind: "notFound" };
  try {
    const response = await billingService.getInvoice(tenantGroupId, invoiceId);
    const refusal = billingRefusal(response ?? {});
    if (refusal === NOT_FOUND || response?.errors?.invoice === NOT_FOUND)
      return { kind: "notFound" };
    if (refusal) return { kind: "error", message: billingReasonMessage(refusal) };
    if (!response?.invoice) return { kind: "notFound" };
    return { kind: "ready", invoice: response.invoice };
  } catch (error) {
    return { kind: "error", message: errorText(error, "The invoice could not be loaded.") };
  }
};

export function InvoicePage() {
  const { tenantGroupId, invoiceId } = useParams();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [downloading, setDownloading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  /** Re-read after a payment or a Try again. */
  const load = useCallback(async () => {
    setState({ kind: "loading" });
    setState(await fetchInvoice(tenantGroupId, invoiceId));
  }, [tenantGroupId, invoiceId]);

  useEffect(() => {
    let cancelled = false;
    void fetchInvoice(tenantGroupId, invoiceId).then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, [tenantGroupId, invoiceId]);

  const invoice = state.kind === "ready" ? state.invoice : null;

  const download = async () => {
    if (!tenantGroupId || !invoice) return;
    setDownloading(true);
    setMessage(null);
    try {
      await billingService.downloadInvoice(tenantGroupId, invoice.invoiceId, invoice.number);
    } catch (error) {
      setMessage({ text: errorText(error, "The invoice could not be downloaded."), error: true });
    } finally {
      setDownloading(false);
    }
  };

  const retry = async () => {
    if (!tenantGroupId) return;
    setRetrying(true);
    setMessage(null);
    try {
      const response = await billingService.retryPayment(tenantGroupId);
      const refusal = billingRefusal(response ?? {});
      if (refusal) {
        setMessage({ text: billingReasonMessage(refusal), error: false });
        return;
      }
      await load();
    } catch (error) {
      setMessage({ text: errorText(error, "The payment could not be started."), error: true });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          to="../.."
          relative="path"
          aria-label="Back to billing"
          className={cn(
            touch,
            "inline-flex items-center gap-1 font-medium text-medium-emphasis hover:text-high-emphasis",
          )}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Billing
        </Link>
        <span className="text-low-emphasis" aria-hidden="true">
          /
        </span>
        <span className="font-mono text-high-emphasis" aria-current="page">
          {invoice?.number ?? "Invoice"}
        </span>
        {invoice && (
          <span className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
            <button
              type="button"
              className={outlineButton}
              onClick={() => void download()}
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
              Download PDF
            </button>
            {invoice.state === "unpaid" && (
              <button
                type="button"
                className={primaryButton}
                onClick={() => void retry()}
                disabled={retrying}
              >
                {retrying && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Retry payment
              </button>
            )}
          </span>
        )}
      </nav>

      {message && (
        <p
          role={message.error ? "alert" : "status"}
          className={cn("text-sm", message.error ? "text-red-700" : "text-warning-800")}
        >
          {message.text}
        </p>
      )}

      {state.kind === "loading" && <LoadingRows rows={6} label="Loading the invoice" />}

      {state.kind === "error" && <LoadError message={state.message} onRetry={() => void load()} />}

      {state.kind === "notFound" && (
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm font-medium text-high-emphasis">Invoice not found</p>
          <p className="mt-1 text-sm text-medium-emphasis">
            {billingReasonMessage(NOT_FOUND)} Go back to billing to see this project&apos;s
            invoices.
          </p>
        </div>
      )}

      {invoice && <InvoiceBody invoice={invoice} />}
    </div>
  );
}

function InvoiceBody({ invoice }: { invoice: IInvoiceView }) {
  const failed = invoiceStatus(invoice) === "failed";
  const hasCard = !!invoice.paymentMethodLastFour;

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-border bg-card p-4 sm:p-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-high-emphasis">Invoice</h1>
          <StatusChip invoice={invoice} />
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
          <dt className="text-medium-emphasis">Number</dt>
          <dd className="font-mono text-high-emphasis">{invoice.number}</dd>
          <dt className="text-medium-emphasis">Issued</dt>
          <dd className="font-mono text-high-emphasis">{day(invoice.issuedAtUtc)}</dd>
          <dt className="text-medium-emphasis">Period</dt>
          <dd className="font-mono text-high-emphasis">
            {period(invoice.periodStartUtc, invoice.periodEndUtc)}
          </dd>
          {invoice.paidAtUtc && (
            <>
              <dt className="text-medium-emphasis">Paid on</dt>
              <dd className="font-mono text-high-emphasis">{day(invoice.paidAtUtc)}</dd>
            </>
          )}
        </dl>
      </header>

      <section aria-label="Payment" className="flex flex-col gap-1 text-sm">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-low-emphasis">
          Payment
        </h2>
        {hasCard ? (
          <p className="text-high-emphasis">
            {invoice.paymentMethodBrand ?? "Card"} ending{" "}
            <span className="font-mono">{invoice.paymentMethodLastFour}</span>
          </p>
        ) : (
          <p className="text-medium-emphasis">No card recorded for this invoice.</p>
        )}
        {failed && <p className="text-warning-800">Declined {day(invoice.declinedAtUtc)}</p>}
        {invoice.state !== "paid" && invoice.nextRetryUtc && (
          <p className="text-medium-emphasis">Next retry {day(invoice.nextRetryUtc)}</p>
        )}
        {failed && (
          <p className="text-medium-emphasis">
            Nothing has been stopped. The amount is carried and retried; this project keeps running.
          </p>
        )}
      </section>

      <section aria-label="Lines" className="flex flex-col">
        {invoice.lines.length === 0 ? (
          <p className="text-sm text-medium-emphasis">This invoice has no lines.</p>
        ) : (
          <ul className="flex flex-col rounded-md border border-border">
            {invoice.lines.map((line, index) => (
              <li
                key={`${line.environment}-${line.label}-${index}`}
                className="flex flex-col gap-1 border-b border-border px-3 py-2.5 text-sm last:border-b-0 sm:flex-row sm:items-center sm:gap-3"
              >
                <span className="sm:w-20 sm:shrink-0">
                  <KindChip billing={line.billing} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-high-emphasis">{line.label || line.environment}</span>
                  <span className="font-mono text-xs text-low-emphasis">
                    {line.environment}
                    {line.units > 0 && ` · ${line.units.toLocaleString("en-US")} units`}
                  </span>
                </span>
                <span className="font-mono text-high-emphasis sm:text-right">
                  {line.amount === 0 ? "Free" : money(invoice.market, line.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <dl className="ml-auto grid w-full grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm sm:w-80">
        {invoice.carriedIn > 0 && (
          <>
            <dt className="text-medium-emphasis">Carried from an earlier period</dt>
            <dd className="text-right font-mono">{money(invoice.market, invoice.carriedIn)}</dd>
          </>
        )}
        <dt className="text-medium-emphasis">Subtotal</dt>
        <dd className="text-right font-mono">{money(invoice.market, invoice.subtotal)}</dd>
        <dt className="text-medium-emphasis">VAT</dt>
        <dd className="text-right font-mono">{money(invoice.market, invoice.vat)}</dd>
        <dt className="border-t border-border pt-2 font-semibold text-high-emphasis">Total</dt>
        <dd className="border-t border-border pt-2 text-right font-mono font-semibold text-high-emphasis">
          {money(invoice.market, invoice.total)}
        </dd>
      </dl>

      <div className="flex flex-col gap-2 border-t border-border pt-4 text-[13px] leading-relaxed text-medium-emphasis">
        <p>
          <b className="text-high-emphasis">Recurring</b> lines are this project&apos;s environments
          and any standing limit held above what they include. They are charged every period until
          changed, and a reduction takes effect at the next period boundary.
        </p>
        <p>
          <b className="text-high-emphasis">One-off</b> lines are units bought outright during the
          period. They are charged once and the units carry forward until spent — they are not
          refunded and they do not expire at the period boundary.
        </p>
        <p>
          This project keeps its own billing period, anchored to the day it was created. Removing an
          environment ends its charge at the next boundary, without a refund for the remainder.
        </p>
      </div>
    </article>
  );
}
