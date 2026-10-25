import { cva, type VariantProps } from "class-variance-authority";
import { CornerDownRight, Globe, Settings2, User, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { ACCESS_LEVEL_TO_TYPE, ACCESS_TYPES } from "../../constants/schema-access-control";

/**
 * Single source of truth for how an access tier looks.
 *
 * Before this existed there were five competing tier palettes — two live (the
 * security table and the schema header) and three dead — and they disagreed:
 * Inherited was grey on one screen and blue in another. Every tier colour now
 * resolves to the --access-* custom properties in globals.css, which carry
 * their own dark-mode values, so there is nothing to keep in sync by hand.
 */
const tierBadgeVariants = cva(
  "inline-flex items-center whitespace-nowrap font-medium transition-colors",
  {
    variants: {
      tier: {
        public: "bg-access-public-bg text-access-public-fg",
        user: "bg-access-user-bg text-access-user-fg",
        custom: "bg-access-custom-bg text-access-custom-fg",
        inherited: "bg-access-inherited-bg text-access-inherited-fg",
      },
      shape: {
        /** Default pill, e.g. the schema access strip. */
        pill: "h-[22px] rounded-md px-2.5 text-xs",
        /** Fixed-width cell for the CRUD matrix, where letters must line up. */
        cell: "h-[26px] w-[30px] justify-center rounded-md text-[11px] font-bold",
      },
      bordered: {
        true: "border",
        false: "border-0",
      },
    },
    compoundVariants: [
      { tier: "public", bordered: true, class: "border-access-public-border" },
      { tier: "user", bordered: true, class: "border-access-user-border" },
      { tier: "custom", bordered: true, class: "border-access-custom-border" },
      { tier: "inherited", bordered: true, class: "border-access-inherited-border" },
    ],
    defaultVariants: { tier: "inherited", shape: "pill", bordered: false },
  },
);

export type AccessTier = NonNullable<VariantProps<typeof tierBadgeVariants>["tier"]>;

/** ACCESS_TYPES string → the variant key used here. */
const TYPE_TO_TIER: Record<string, AccessTier> = {
  [ACCESS_TYPES.PUBLIC]: "public",
  [ACCESS_TYPES.LOGGED_IN]: "user",
  [ACCESS_TYPES.CUSTOM]: "custom",
  [ACCESS_TYPES.INHERITED]: "inherited",
};

export const ACCESS_TIER_LABELS: Record<AccessTier, string> = {
  public: "Public",
  user: "Requester",
  custom: "Custom",
  inherited: "Inherited",
};

/** Tier's icon, for compact chips/tiles where the label text is dropped. */
export const TIER_ICON: Record<AccessTier, LucideIcon> = {
  public: Globe,
  user: User,
  custom: Settings2,
  inherited: CornerDownRight,
};

/**
 * Resolve a SchemaAccessLevel to a tier.
 *
 * NOTE: the enum is Inherited=0, User=1, Public=2, Custom=3 — numeric order is
 * NOT risk order. Never sort or compare on the raw level to infer exposure.
 */
export function tierFromLevel(level: number | undefined | null): AccessTier {
  return tierFromType(ACCESS_LEVEL_TO_TYPE[level ?? 0]);
}

/** ACCESS_TYPES string → tier, for code that already resolved the type. */
export function tierFromType(type: string | undefined | null): AccessTier {
  return TYPE_TO_TIER[type ?? ""] ?? "inherited";
}

interface AccessTierBadgeProps extends VariantProps<typeof tierBadgeVariants> {
  /** SchemaAccessLevel. Takes precedence over `tier` when both are given. */
  level?: number | null;
  /** Overrides the tier's default label — e.g. a single letter in the matrix. */
  children?: React.ReactNode;
  className?: string;
  title?: string;
}

export function AccessTierBadge({
  level,
  tier,
  shape,
  bordered,
  children,
  className,
  title,
}: Readonly<AccessTierBadgeProps>) {
  const resolved = level === undefined || level === null ? (tier ?? "inherited") : tierFromLevel(level);

  return (
    <span
      className={cn(tierBadgeVariants({ tier: resolved, shape, bordered }), className)}
      title={title ?? ACCESS_TIER_LABELS[resolved]}
    >
      {children ?? ACCESS_TIER_LABELS[resolved]}
    </span>
  );
}

/** Tier's border + background, e.g. for a selected tile or pill container. */
export const TIER_CONTAINER_CLASS: Record<AccessTier, string> = {
  public: "border-access-public-border bg-access-public-bg",
  user: "border-access-user-border bg-access-user-bg",
  custom: "border-access-custom-border bg-access-custom-bg",
  inherited: "border-access-inherited-border bg-access-inherited-bg",
};

/** Tier's foreground text colour. */
export const TIER_VALUE_CLASS: Record<AccessTier, string> = {
  public: "text-access-public-fg",
  user: "text-access-user-fg",
  custom: "text-access-custom-fg",
  inherited: "text-access-inherited-fg",
};

/** Tier's dot colour, as a background-color utility (for a radio bullet). */
export const TIER_DOT_CLASS: Record<AccessTier, string> = {
  public: "bg-access-public-dot",
  user: "bg-access-user-dot",
  custom: "bg-access-custom-dot",
  inherited: "bg-access-inherited-dot",
};

/**
 * A verb ("Create") and its tier ("Custom") sharing one bordered, tier-tinted
 * pill — the schema header's own access strip.
 *
 * `AccessTierBadge` colours every child the same, which is right for a bare
 * tier value but wrong here: the verb is a label *about* the pill, so it stays
 * muted while only the tier value takes the tier's colour, the way every board
 * draws it. Kept as one component rather than two badges side by side so the
 * verb and its value can never end up outside each other's border again.
 */
export function AccessVerbPill({
  level,
  tier,
  verb,
  onClick,
  className,
  /** Drops the tier's text label, keeping just its icon — for a narrow header. */
  compact = false,
}: Readonly<{
  level?: number | null;
  tier?: AccessTier;
  verb: string;
  onClick?: () => void;
  className?: string;
  compact?: boolean;
}>) {
  const resolved = level === undefined || level === null ? (tier ?? "inherited") : tierFromLevel(level);
  const Icon = TIER_ICON[resolved];

  return (
    <button
      type="button"
      onClick={onClick}
      // Adjacent spans with no text node between them read as one run-on
      // word ("CreateCustom") to a screen reader; say it properly instead.
      // The full tier name stays here even when its text is visually
      // dropped, so the accessible name never shrinks along with the chip.
      aria-label={`${verb} ${ACCESS_TIER_LABELS[resolved]}`}
      title={ACCESS_TIER_LABELS[resolved]}
      className={cn(
        // Hover was `opacity-80`, which fades the label along with the chip and
        // reads as the control going inactive. A ring keeps the tier colour at
        // full strength and matches how every other row and chip here responds.
        "dg-interactive flex h-[26px] items-center gap-1.5 rounded-md border px-2.5 text-xs hover:ring-2 hover:ring-primary/15 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40",
        TIER_CONTAINER_CLASS[resolved],
        className,
      )}
    >
      <span className="text-muted-foreground" aria-hidden>
        {verb}
      </span>
      <Icon className={cn("h-3.5 w-3.5 shrink-0", TIER_VALUE_CLASS[resolved])} aria-hidden />
      {!compact && (
        <span className={cn("font-semibold", TIER_VALUE_CLASS[resolved])} aria-hidden>
          {ACCESS_TIER_LABELS[resolved]}
        </span>
      )}
    </button>
  );
}

/** Small status dot in the tier's colour, for dense rows like the schema list. */
export function AccessTierDot({
  level,
  tier,
  className,
  title,
}: Readonly<Pick<AccessTierBadgeProps, "level" | "tier" | "className" | "title">>) {
  const resolved = level === undefined || level === null ? (tier ?? "inherited") : tierFromLevel(level);

  return (
    <span
      className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", TIER_DOT_CLASS[resolved], className)}
      title={title ?? ACCESS_TIER_LABELS[resolved]}
    />
  );
}

