import { Tabs, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import { cn } from "@/lib/utils";
import { STORAGE_TIERS, type StorageTier } from "./storage-tier-cards";

interface StorageTierSwitcherProps {
  value: StorageTier;
  onChange: (tier: StorageTier) => void;
  /** Overrides a tier's blurb where a page holds something more specific than "data". */
  descriptions?: Partial<Record<StorageTier, string>>;
  className?: string;
}

/**
 * The same three tiers as {@link StorageTierCards}, as one segmented control sized to sit in a
 * toolbar row beside the service tabs. The blurb each card spelled out is carried by the
 * tooltip instead, so the choice costs a row of icons rather than a band of cards.
 */
export function StorageTierSwitcher({
  value,
  onChange,
  descriptions,
  className,
}: StorageTierSwitcherProps) {
  // Re-picking the current tier is not a change: it would otherwise reset the page and paging
  // of a list the reader is already reading.
  const pick = (tier: StorageTier) => {
    if (tier !== value) onChange(tier);
  };

  return (
    <TooltipProvider>
      <Tabs
        value={value}
        onValueChange={(next: string) => pick(next as StorageTier)}
        className={className}
      >
        <TabsList aria-label="Storage tier" className="h-[42px] bg-blocks-primary-shades-300">
          {STORAGE_TIERS.map(({ value: tier, title, description, Icon }) => (
            <Tooltip key={tier}>
              <TooltipTrigger asChild>
                {/* asChild keeps the trigger the tab button itself, so the tabs stay direct
                    children of the list and keep their arrow-key navigation. It also lands
                    the tooltip's own data-state (open/closed) on this button, overwriting the
                    tab's -- so the selected look is driven by the value we already hold rather
                    than by the kit's data-[state=active] classes, which never match here. */}
                <TabsTrigger
                  value={tier}
                  className={cn(
                    "h-8 w-fit gap-1.5",
                    tier === value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {title}
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent className="border-none bg-neutral-500 text-white shadow-none">
                {descriptions?.[tier] ?? description}
              </TooltipContent>
            </Tooltip>
          ))}
        </TabsList>
      </Tabs>
    </TooltipProvider>
  );
}
