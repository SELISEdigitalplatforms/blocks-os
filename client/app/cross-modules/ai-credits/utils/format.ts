import { ILastTopUp } from "../models/ai-credits.model";
import { getLanguageCode, tStatic } from "@seliseblocks/genesis-os";

const creditFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export const formatCredits = (value: number): string => creditFormat.format(value);

/** Share of `part` in `whole` as 0-100, 0 when there is nothing to share. */
export const percentOf = (part: number, whole: number): number =>
  whole > 0 ? Math.min(100, Math.max(0, (part / whole) * 100)) : 0;

/** Date format follows the chosen UI language (English keeps the day-month order used so far). */
const dateLocale = () => (getLanguageCode() === "de" ? "de-DE" : "en-GB");

export const formatShortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(dateLocale(), { day: "numeric", month: "short" });

export const formatLongDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(dateLocale(), { day: "numeric", month: "short", year: "numeric" });

const STATE_LABELS: Record<ILastTopUp["state"], string> = {
  get Created() { return tStatic("os.ai-credits", "FORMAT.WAITING_FOR_PAYMENT"); },
  get CheckoutOpen() { return tStatic("os.ai-credits", "FORMAT.WAITING_FOR_PAYMENT"); },
  get Paid() { return tStatic("os.ai-credits", "FORMAT.PAID"); },
  get Failed() { return tStatic("os.ai-credits", "FORMAT.FAILED"); },
  get Cancelled() { return tStatic("os.ai-credits", "FORMAT.CANCELLED"); },
  get Expired() { return tStatic("os.ai-credits", "FORMAT.EXPIRED"); },
};

export const describeLastTopUp = (lastTopUp: ILastTopUp | null): string => {
  if (!lastTopUp) return tStatic("os.ai-credits", "FORMAT.NONE_YET");
  const when = lastTopUp.createdDate ? `${formatLongDate(lastTopUp.createdDate)} · ` : "";
  if (lastTopUp.state === "Paid" && lastTopUp.creditsGranted != null)
    return `${when}${tStatic("os.ai-credits", "FORMAT.CREDITS_AMOUNT", { amount: formatCredits(lastTopUp.creditsGranted) })}`;
  return `${when}${STATE_LABELS[lastTopUp.state] ?? lastTopUp.state}`;
};

/** `ZJWLGQ7Y` -> `ZJWL-GQ7Y`, the way the code is printed on a coupon. */
export const formatCouponCode = (code: string): string =>
  code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
