import { cn } from "@/lib/utils";

import type { IField } from "../../models/data-service";

/**
 * The three genuine booleans on a property, as one compact strip.
 *
 * IsRequired is deliberately absent: it is a 4-state enum (None | Insert |
 * Update | Both), so it gets its own column via <RequiredBadge />. Folding it
 * in here would silently lose Insert/Update/Both.
 *
 * All three share the primary blue, kept to a whisper: a faint translucent
 * fill, a hairline border and softened text. Solid multi-colour fills and bold
 * type made a column of badges louder than the property names.
 */
export type FieldFlag = "ARR" | "PII" | "UQ";

const FLAG_TITLES: Record<FieldFlag, string> = {
  ARR: "Array",
  PII: "Personally identifiable data",
  UQ: "Unique",
};

/**
 * One tint for every flag, taken from the app's primary blue as translucent
 * layers over the surface behind it: a faint fill, a hairline border, softened
 * text. The label (ARR / PII / UQ) tells them apart, not a colour.
 */
const FLAG_TINT = { bg: "bg-primary/5", fg: "text-primary/85", border: "border-primary/25" };

export function flagsFromField(field: Pick<IField, "isArray" | "isPIIData" | "isUniqueData">) {
  const flags: FieldFlag[] = [];
  if (field.isArray) flags.push("ARR");
  if (field.isPIIData) flags.push("PII");
  if (field.isUniqueData) flags.push("UQ");
  return flags;
}

export function FieldFlagChip({ flag, className }: { flag: FieldFlag; className?: string }) {
  return (
    <span
      title={FLAG_TITLES[flag]}
      className={cn(
        "inline-flex h-[20px] items-center rounded border px-1.5 text-[10px] font-medium tracking-wide",
        FLAG_TINT.bg,
        FLAG_TINT.fg,
        FLAG_TINT.border,
        className,
      )}
    >
      {flag}
    </span>
  );
}

export function FieldFlags({ flags, className }: { flags: FieldFlag[]; className?: string }) {
  if (flags.length === 0) return null;

  return (
    <span className={cn("flex items-center gap-1", className)}>
      {flags.map((flag) => (
        <FieldFlagChip key={flag} flag={flag} />
      ))}
    </span>
  );
}

/**
 * The editable form of `FieldFlagChip`: a click toggles the flag instead of
 * only displaying it. Off carries the flag's own colour muted down to a
 * border, rather than switching to a generic on/off control — the same chip
 * you'd see in read mode, just interactive.
 *
 * ARR/UQ switch to their own tint on activation rather than the read-mode
 * `flag-neutral` grey — that grey reads fine as a settled badge, but next to
 * the same grey border it was just toggled from, "on" wasn't visibly
 * different from "off", and ARR/UQ need to stay distinguishable from each
 * other too, not just from "off". PII keeps its own warm tint either way,
 * since that one already carries colour at rest.
 */
export function FlagToggleChip({
  flag,
  active,
  disabled,
  onToggle,
  className,
}: {
  flag: FieldFlag;
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={FLAG_TITLES[flag]}
      aria-pressed={active}
      aria-label={FLAG_TITLES[flag]}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "inline-flex h-[26px] min-w-[36px] items-center justify-center rounded border px-2 text-[10.5px] font-medium tracking-wide transition-colors",
        active
          ? cn(FLAG_TINT.border, FLAG_TINT.bg, FLAG_TINT.fg)
          : "border-border/50 text-muted-foreground/50",
        disabled ? "cursor-not-allowed opacity-60" : "hover:border-primary/40",
        className,
      )}
    >
      {flag}
    </button>
  );
}

