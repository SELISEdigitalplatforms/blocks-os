import { FormEvent, useState } from "react";
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui-kits/button/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui-kits/input-otp/input-otp";
import { COUPON_CODE_LENGTH, COUPON_TOP_UP_AMOUNT_CHF } from "../constants/endpoint.constant";
import { useRedeemCoupon } from "../hooks/use-ai-credits";
import { getCouponErrorMessage, NOT_FULLY_COVERED_MESSAGE } from "../utils/coupon-error";
import { formatCouponCode, formatCredits, formatLongDate } from "../utils/format";

type Redeemed = { code: string; credits: number | null; validUntil: string | null };

const CodeSlot = ({ index, invalid }: { index: number; invalid: boolean }) => (
  <InputOTPSlot
    index={index}
    className={cn(
      "h-12 w-10 rounded-md border font-mono text-lg font-semibold uppercase first:rounded-md first:border-l last:rounded-md sm:w-11",
      invalid && "border-destructive bg-destructive/5",
    )}
  />
);

export const RedeemCouponCard = () => {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [redeemed, setRedeemed] = useState<Redeemed | null>(null);
  const { mutateAsync: redeem, isPending } = useRedeemCoupon();

  const onChange = (value: string) => {
    setCode(value.toUpperCase());
    setError(null);
  };

  const onClear = () => {
    setCode("");
    setError(null);
    setRedeemed(null);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isPending) return;
    if (code.length < COUPON_CODE_LENGTH) {
      setError(code ? "Enter all 8 characters of the code." : "Enter a coupon code.");
      return;
    }
    setRedeemed(null);
    try {
      const order = await redeem({
        amountChf: COUPON_TOP_UP_AMOUNT_CHF,
        requestId: crypto.randomUUID(),
        couponCode: code,
      });
      if (order.state === "Paid") {
        setRedeemed({ code, credits: order.creditsGranted, validUntil: order.validUntil });
        setCode("");
      } else {
        // A payment would be needed. This page does not take payments, so it never opens checkout.
        setError(NOT_FULLY_COVERED_MESSAGE);
      }
    } catch (err) {
      setError(getCouponErrorMessage(err));
    }
  };

  return (
    <section
      aria-labelledby="ai-credits-redeem-title"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card px-6 py-5"
    >
      <div className="flex flex-col gap-0.5">
        <h2 id="ai-credits-redeem-title" className="text-base font-semibold text-high-emphasis">
          Redeem a coupon
        </h2>
        <p className="text-sm text-medium-emphasis">Enter the 8-character code from your coupon.</p>
      </div>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
        <span id="ai-credits-code-label" className="text-sm font-semibold text-high-emphasis">
          Coupon code
        </span>
        <div className="flex flex-wrap items-center gap-4">
          <InputOTP
            maxLength={COUPON_CODE_LENGTH}
            pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            value={code}
            onChange={onChange}
            disabled={isPending}
            aria-labelledby="ai-credits-code-label"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "ai-credits-code-error" : undefined}
            containerClassName="gap-2"
          >
            <InputOTPGroup className="gap-2">
              {[0, 1, 2, 3].map((index) => (
                <CodeSlot key={index} index={index} invalid={!!error} />
              ))}
            </InputOTPGroup>
            <InputOTPSeparator className="text-medium-emphasis" />
            <InputOTPGroup className="gap-2">
              {[4, 5, 6, 7].map((index) => (
                <CodeSlot key={index} index={index} invalid={!!error} />
              ))}
            </InputOTPGroup>
          </InputOTP>
          <Button type="submit" disabled={isPending} className="h-12 px-6">
            {isPending && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
            {isPending ? "Redeeming…" : "Redeem"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClear}
            disabled={isPending || (!code && !error && !redeemed)}
            className="h-12 px-6"
          >
            Clear
          </Button>
        </div>
        {error && (
          <p
            id="ai-credits-code-error"
            role="alert"
            className="flex items-start gap-1.5 text-sm text-destructive"
          >
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
      </form>

      {redeemed && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm text-high-emphasis"
        >
          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <p>
            <strong className="font-semibold">
              {redeemed.credits != null
                ? `${formatCredits(redeemed.credits)} credits added.`
                : "Credits added."}
            </strong>{" "}
            Coupon {formatCouponCode(redeemed.code)} is redeemed.
            {redeemed.validUntil
              ? ` The credits are valid until ${formatLongDate(redeemed.validUntil)}.`
              : ""}
          </p>
        </div>
      )}
    </section>
  );
};
