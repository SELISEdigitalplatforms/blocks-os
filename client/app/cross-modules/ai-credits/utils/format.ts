import { ILastTopUp } from "../models/ai-credits.model";

const creditFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export const formatCredits = (value: number): string => creditFormat.format(value);

/** Share of `part` in `whole` as 0-100, 0 when there is nothing to share. */
export const percentOf = (part: number, whole: number): number =>
  whole > 0 ? Math.min(100, Math.max(0, (part / whole) * 100)) : 0;

export const formatShortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export const formatLongDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const STATE_LABELS: Record<ILastTopUp["state"], string> = {
  Created: "Waiting for payment",
  CheckoutOpen: "Waiting for payment",
  Paid: "Paid",
  Failed: "Failed",
  Cancelled: "Cancelled",
  Expired: "Expired",
};

export const describeLastTopUp = (lastTopUp: ILastTopUp | null): string => {
  if (!lastTopUp) return "None yet";
  const when = lastTopUp.createdDate ? `${formatLongDate(lastTopUp.createdDate)} · ` : "";
  if (lastTopUp.state === "Paid" && lastTopUp.creditsGranted != null)
    return `${when}${formatCredits(lastTopUp.creditsGranted)} credits`;
  return `${when}${STATE_LABELS[lastTopUp.state] ?? lastTopUp.state}`;
};

/** `ZJWLGQ7Y` -> `ZJWL-GQ7Y`, the way the code is printed on a coupon. */
export const formatCouponCode = (code: string): string =>
  code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
