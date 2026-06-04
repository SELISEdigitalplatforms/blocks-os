import type { KeyboardEvent } from "react"
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox"
import { Badge } from "@/components/ui-kits/badge/badge"
import { cn } from "@/lib/utils"

type ServiceSelectionCardProps = {
  label: string
  tags: string[]
  checked: boolean
  available: boolean
  onCheckedChange: (checked: boolean) => void
}

export const ServiceSelectionCard = ({
  label,
  tags,
  checked,
  available,
  onCheckedChange,
}: ServiceSelectionCardProps) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!available) return
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault()
    onCheckedChange(!checked)
  }

  return (
    <div
      role="checkbox"
      aria-checked={available ? checked : false}
      aria-disabled={!available}
      tabIndex={available ? 0 : -1}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4 transition-colors",
        available
          ? "cursor-pointer border-border bg-background hover:bg-muted/30"
          : "cursor-not-allowed border-border/60 bg-muted/40 opacity-70",
      )}
      onClick={() => {
        if (!available) return
        onCheckedChange(!checked)
      }}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={checked}
          disabled={!available}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Select ${label} for migration`}
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-base font-medium",
              available ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {label}
          </p>
          {!available && (
            <p className="mt-1 text-sm text-muted-foreground">
              Not available for this service
            </p>
          )}
        </div>
      </div>
      {available && tags.length > 0 && (
        <div className="flex flex-wrap gap-2 pl-7">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="rounded-md border-border bg-muted/50 px-2 py-0.5 text-xs font-normal text-foreground"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
