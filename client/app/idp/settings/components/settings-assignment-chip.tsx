import { cn } from "@/lib/utils"

type SettingsAssignmentChipProps = {
  label: string
  meta?: string
  className?: string
}

export const SettingsAssignmentChip = ({
  label,
  meta,
  className,
}: SettingsAssignmentChipProps) => {
  const accessibleName = meta ? `${label} (${meta})` : label

  return (
    <span
      role="listitem"
      aria-label={accessibleName}
      title={accessibleName}
      className={cn(
        "inline-flex h-8 w-full max-w-full items-center gap-2 rounded-full sm:w-auto",
        "border border-border/70 bg-muted/40 px-3",
        "text-sm shadow-sm transition-colors",
        className,
      )}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
      />
      <span className="flex min-w-0 items-baseline gap-1 truncate leading-none">
        <span className="truncate font-medium text-foreground">{label}</span>
        {meta ? (
          <span className="truncate text-xs font-normal text-muted-foreground">
            ({meta})
          </span>
        ) : null}
      </span>
    </span>
  )
}
