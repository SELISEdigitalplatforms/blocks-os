import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { TRACE_PROVIDERS } from "@blocks-lmt/constants/trace.constant";
import { useIsMobile } from "@seliseblocks/genesis-os/hooks";
import { Archive, Flame, Snowflake } from "lucide-react";
import { tStatic } from "@seliseblocks/genesis-os";

export type StorageTier = `${TRACE_PROVIDERS}`;

/**
 * The tier a reader is looking at. Shared by Tracing and Logs so the two pages name the tiers
 * the same way -- both read the same restore request, and a reader who learns "cold" on one page
 * should not meet a different word for it on the other.
 */
export const getStorageTiers = () =>
  [
    {
      value: TRACE_PROVIDERS.hot,
      title: tStatic("os.lmt", "STORAGE_TIER_CARDS.HOT"),
      description: tStatic("os.lmt", "STORAGE_TIER_CARDS.LIVE_AND_RECENT_DATA_FOR"),
      Icon: Flame,
    },
    {
      value: TRACE_PROVIDERS.cold,
      title: tStatic("os.lmt", "STORAGE_TIER_CARDS.COLD"),
      description: tStatic("os.lmt", "STORAGE_TIER_CARDS.LONGER_TERM_STORED_DATA_FOR"),
      Icon: Snowflake,
    },
    {
      value: TRACE_PROVIDERS.archive,
      title: tStatic("os.lmt", "STORAGE_TIER_CARDS.ARCHIVE"),
      description: tStatic("os.lmt", "STORAGE_TIER_CARDS.DEEP_HISTORY_RETAINED_FOR_AUDIT"),
      Icon: Archive,
    },
  ] as const;

interface StorageTierCardsProps {
  value: StorageTier;
  onChange: (tier: StorageTier) => void;
  /** Overrides a tier's blurb where a page holds something more specific than "data". */
  descriptions?: Partial<Record<StorageTier, string>>;
}

export function StorageTierCards({ value, onChange, descriptions }: StorageTierCardsProps) {
  const isMobile = useIsMobile();

  // Re-picking the current tier is not a change: it would otherwise reset the page and paging
  // of a list the reader is already reading.
  const pick = (tier: StorageTier) => {
    if (tier !== value) onChange(tier);
  };

  if (isMobile) {
    return (
      <Select value={value} onValueChange={(next: string) => pick(next as StorageTier)}>
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {getStorageTiers().map((tier) => (
            <SelectItem key={tier.value} value={tier.value}>
              {tier.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {getStorageTiers().map(({ value: tier, title, description, Icon }) => {
        const isActive = tier === value;
        return (
          <button
            key={tier}
            type="button"
            aria-pressed={isActive}
            onClick={() => pick(tier)}
            className={[
              "rounded-xl border p-4 text-left transition-all",
              isActive
                ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/20"
                : "border-border bg-background hover:border-primary/40 hover:bg-accent/30",
            ].join(" ")}
          >
            <div className="flex items-center gap-3">
              <div
                className={[
                  "rounded-lg p-2",
                  isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="font-medium text-high-emphasis">{title}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {descriptions?.[tier] ?? description}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
