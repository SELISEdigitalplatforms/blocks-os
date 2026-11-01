import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui-kits/progress/progress";
import { IAgentCreditsUsage } from "../models/ai-credits.model";
import { describeLastTopUp, formatCredits, formatShortDate, percentOf } from "../utils/format";
import { useT } from "@seliseblocks/genesis-os";

type PoolTileProps = {
  title: string;
  left: number;
  included: number;
  used: number;
  note?: string;
  tone: "free" | "coupon";
};

const PoolTile = ({ title, left, included, used, note, tone }: PoolTileProps) => {
  const { t } = useT("os.ai-credits");
  return (
  <div
    className={cn(
      "flex flex-col gap-2.5 rounded-lg border p-4",
      tone === "free"
        ? "border-primary/20 bg-primary/5"
        : "border-blocks-secondary-600/25 bg-blocks-secondary-50",
    )}
  >
    <div className="flex items-baseline justify-between gap-2">
      <span className="flex items-center gap-2 text-sm font-semibold text-high-emphasis">
        <span
          aria-hidden="true"
          className={cn(
            "h-2.5 w-2.5 rounded-sm",
            tone === "free" ? "bg-primary" : "bg-blocks-secondary-600",
          )}
        />
        {title}
      </span>
      <span className="text-sm tabular-nums text-medium-emphasis">
        {t("USAGE_CARD.OF_LEFT", { strong: `${formatCredits(left)}`, included: formatCredits(included) })}</span>
    </div>
    <Progress
      value={percentOf(left, included)}
      aria-label={t("USAGE_CARD.OF_LEFT_2", { title, left: formatCredits(left), included: formatCredits(included) })}
      className={cn("h-2.5", tone === "free" ? "bg-primary/15" : "bg-blocks-secondary-600/15")}
      indicatorClassName={tone === "free" ? "bg-primary" : "bg-blocks-secondary-600"}
    />
    <span className="text-xs text-medium-emphasis">
      {t("USAGE_CARD.USED", { used: formatCredits(used), value2: note ? ` ${note}` : "" })}
    </span>
  </div>
);
};

export const UsageCard = ({ usage }: { usage: IAgentCreditsUsage }) => {
  const { t } = useT("os.ai-credits");
  return (
  <section
    aria-labelledby="ai-credits-usage-title"
    className="overflow-hidden rounded-lg border border-border bg-card"
  >
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-6 py-5">
      <div className="flex flex-col gap-0.5">
        <h2
          id="ai-credits-usage-title"
          className="text-xs font-semibold uppercase tracking-wider text-medium-emphasis"
        >
          {t("USAGE_CARD.AVAILABLE_BALANCE")}
        </h2>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold tabular-nums leading-tight text-high-emphasis">
            {formatCredits(usage.remaining)}
          </span>
          <span className="text-sm text-medium-emphasis">{t("USAGE_CARD.CREDITS")}</span>
        </div>
      </div>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
          usage.allowed ? "bg-[#DDF5EA] text-[#0B5A33]" : "bg-[#FFE2DD] text-[#8C0714]",
        )}
      >
        <span
          aria-hidden="true"
          className={cn("h-2 w-2 rounded-full", usage.allowed ? "bg-[#12A15A]" : "bg-[#D92D20]")}
        />
        {usage.allowed ? t("USAGE_CARD.AGENTS_CAN_RUN") : t("USAGE_CARD.NO_CREDITS_LEFT")}
      </span>
    </div>

    <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-2">
      <PoolTile
        title={t("USAGE_CARD.FREE_CREDITS")}
        left={usage.free.remaining}
        included={usage.free.included}
        used={usage.free.used}
        note={t("USAGE_CARD.EVERY_PROJECT_STARTS_WITH_THEM")}
        tone="free"
      />
      <PoolTile
        title={t("USAGE_CARD.VOUCHER_CREDITS")}
        left={usage.paid.remaining}
        included={usage.paid.included}
        used={usage.paid.used}
        tone="coupon"
      />
    </div>

    <div className="flex flex-col gap-2.5 px-6 pb-5">
      {usage.paid.expiries.length > 0 && (
        <>
          <h3 className="text-xs font-semibold text-medium-emphasis">{t("USAGE_CARD.EXPIRING_CREDITS")}</h3>
          <ul className="flex flex-wrap gap-2">
            {usage.paid.expiries.map((expiry) => (
              <li
                key={`${expiry.expiresAtUtc}-${expiry.credits}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-warning-300 bg-warning-50 px-3 py-1 text-xs tabular-nums text-warning-900"
              >
                <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                {t("USAGE_CARD.VALID_UNTIL", { strong: `${formatCredits(expiry.credits)}`, expiresAtUtc: formatShortDate(expiry.expiresAtUtc) })}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-3 text-xs text-medium-emphasis">
        <span>{t("USAGE_CARD.LAST_TOP_UP")}</span>
        <span className="text-high-emphasis">{describeLastTopUp(usage.lastTopUp)}</span>
      </div>
    </div>
  </section>
);
};
