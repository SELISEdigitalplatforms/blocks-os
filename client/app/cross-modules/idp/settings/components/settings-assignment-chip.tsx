import { cn } from "@/lib/utils"

export type SettingsAssignmentChipVariant = "saved" | "unsaved" | "removed"

type SettingsAssignmentChipProps = {
  label: string
  meta?: string
  variant?: SettingsAssignmentChipVariant
  className?: string
}

const CHIP_STYLES: Record<
  SettingsAssignmentChipVariant,
  { chip: string; dot: string; label: string; hint: string }
> = {
  saved: {
    chip: "border-border/70 bg-muted/40",
    dot: "bg-emerald-500",
    label: "text-foreground",
    hint: "",
  },
  unsaved: {
    chip: "border-amber-500/60 bg-amber-500/10",
    dot: "bg-amber-500",
    label: "text-foreground",
    hint: "not saved yet",
  },
  removed: {
    chip: "border-red-500/60 bg-red-500/10",
    dot: "bg-red-500",
    label: "text-muted-foreground line-through",
    hint: "will be removed on save",
  },
}

export const SettingsAssignmentChip = ({
  label,
  meta,
  variant = "saved",
  className,
}: SettingsAssignmentChipProps) => {
  const styles = CHIP_STYLES[variant]
  const baseName = meta ? `${label} (${meta})` : label
  const accessibleName = styles.hint ? `${baseName} — ${styles.hint}` : baseName

  return (
    <span
      role="listitem"
      aria-label={accessibleName}
      title={accessibleName}
      className={cn(
        "inline-flex h-8 w-full max-w-full items-center gap-2 rounded-full sm:w-auto",
        "border px-3",
        "text-sm shadow-sm transition-colors",
        styles.chip,
        className,
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", styles.dot)} />
      <span className="flex min-w-0 items-baseline gap-1 truncate leading-none">
        <span className={cn("truncate font-medium", styles.label)}>{label}</span>
        {meta ? (
          <span className="truncate text-xs font-normal text-muted-foreground">
            ({meta})
          </span>
        ) : null}
      </span>
    </span>
  )
}
