import { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { IInvoiceView } from "@blocks-identifier/models/billing.model";

/**
 * Small pieces the three billing screens share: money and date formats, the line-kind and
 * invoice-state chips, and the loading / error frames.
 *
 * Colour rule: amber for anything owed (nothing is suspended over it), red only for an outright
 * error such as a request that failed.
 */

export const money = (market: string, amount: number) =>
  `${market} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "12 Sep 2026", in UTC (billing dates are UTC boundaries). A missing or unparsable date reads as a dash, never "Invalid Date". */
export const day = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  // Spelled out rather than toLocaleDateString: ICU versions disagree ("Sep" vs "Sept").
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
};

/** "12 Sep – 12 Oct 2026", or a dash when the invoice has no period (older invoices). */
export const period = (start?: string | null, end?: string | null) =>
  !start && !end ? "—" : `${day(start)} – ${day(end)}`;

/** Buttons and links: 44px tall on a phone, the usual 36px from `sm` up. */
export const touch = "min-h-11 sm:min-h-9";

const CHIP =
  "inline-block rounded px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide";

/** Recurring ("rent") or One-off ("once"). An unknown value is shown as it came, not guessed. */
export const KindChip = ({ billing }: { billing: string | undefined }) => {
  if (billing === "rent")
    return <span className={cn(CHIP, "bg-warning-100 text-warning-800")}>Recurring</span>;
  if (billing === "once")
    return (
      <span className={cn(CHIP, "bg-blocks-primary-50 text-blocks-primary-700")}>One-off</span>
    );
  return billing ? (
    <span className={cn(CHIP, "bg-muted text-medium-emphasis")}>{billing}</span>
  ) : null;
};

export type InvoiceStatus = "paid" | "failed" | "unpaid";

export const invoiceStatus = (invoice: IInvoiceView): InvoiceStatus =>
  invoice.state === "paid" ? "paid" : invoice.declinedAtUtc ? "failed" : "unpaid";

const STATUS: Record<InvoiceStatus, { label: string; className: string }> = {
  paid: {
    label: "Paid",
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  // Amber: a failed charge is carried, nothing stops.
  failed: { label: "Payment failed", className: "bg-warning-100 text-warning-800" },
  unpaid: { label: "Unpaid", className: "bg-blocks-primary-50 text-blocks-primary-700" },
};

export const StatusChip = ({ invoice }: { invoice: IInvoiceView }) => {
  const status = STATUS[invoiceStatus(invoice)];
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        status.className,
      )}
    >
      {status.label}
    </span>
  );
};

/** Sum of the invoice lines per kind. Null when the invoice carries no lines to add up. */
export const kindTotals = (invoice: IInvoiceView) => {
  if (!invoice.lines?.length) return null;
  let recurring = 0;
  let oneOff = 0;
  for (const line of invoice.lines) {
    if (line.billing === "rent") recurring += line.amount;
    else if (line.billing === "once") oneOff += line.amount;
  }
  return { recurring, oneOff };
};

export const SectionTitle = ({ children, aside }: { children: ReactNode; aside?: ReactNode }) => (
  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
    <h2 className="text-[13px] font-semibold uppercase tracking-wider text-medium-emphasis">
      {children}
    </h2>
    {aside && <span className="text-xs text-low-emphasis">{aside}</span>}
  </div>
);

/** A request that failed outright. Red is right here: something did not work. */
export const LoadError = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div
    role="alert"
    className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900 sm:flex-row sm:items-center"
  >
    <CircleAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
    <p className="flex-1 text-sm">{message}</p>
    <button
      type="button"
      onClick={onRetry}
      className={cn(
        touch,
        "rounded-md border border-red-300 bg-white px-4 text-sm font-medium text-red-900 hover:bg-red-100",
      )}
    >
      Try again
    </button>
  </div>
);

export const LoadingRows = ({ rows = 3, label }: { rows?: number; label: string }) => (
  <div className="flex flex-col gap-2" aria-busy="true" aria-label={label}>
    {Array.from({ length: rows }, (_, i) => (
      <Skeleton key={i} className="h-10 w-full" />
    ))}
  </div>
);

export const errorText = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;
