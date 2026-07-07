import ConfirmationModal from "@/components/confirmation-modal/confirmation-modal"
import { Button } from "@/components/ui-kits/button/button"
import { Dialog, DialogTrigger } from "@/components/ui-kits/dialog/dialog"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import { useState } from "react"

type SettingsDismissibleChipProps = {
  title: string
  subtitle?: string
  confirmTitle: string
  confirmSubtitle: string
  onDismiss: () => void
  className?: string
  readOnly?: boolean
  variant?: "chip" | "badge"
}

export const SettingsDismissibleChip = ({
  title,
  subtitle,
  confirmTitle,
  confirmSubtitle,
  onDismiss,
  className,
  readOnly = false,
  variant = "chip",
}: SettingsDismissibleChipProps) => {
  const [open, setOpen] = useState(false)

  const handleConfirm = () => {
    onDismiss()
    setOpen(false)
  }

  return (
    <div
      className={cn(
        variant === "badge"
          ? "relative inline-flex min-h-10 w-full max-w-full flex-col items-start justify-center rounded-xl border bg-muted/40 px-3 py-1.5 pr-8 sm:w-auto"
          : "relative rounded-lg border bg-card p-4 pr-10 shadow-sm",
        className,
      )}
    >
      <p
        className={cn(
          "truncate text-foreground",
          variant === "badge" ? "text-xs font-medium" : "text-sm font-semibold",
        )}
        title={title}
      >
        {title}
      </p>
      {subtitle ? (
        <p
          className={cn(
            "truncate text-muted-foreground",
            variant === "badge" ? "text-[11px]" : "mt-1 text-xs",
          )}
          title={subtitle}
        >
          {subtitle}
        </p>
      ) : null}
      {!readOnly ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "absolute rounded-full text-muted-foreground hover:text-foreground",
                variant === "badge"
                  ? "right-1 top-1 h-5 w-5"
                  : "right-1.5 top-1.5 h-7 w-7",
              )}
              aria-label={`Remove ${title}`}
            >
              <X className={cn(variant === "badge" ? "h-3 w-3" : "h-3.5 w-3.5")} />
            </Button>
          </DialogTrigger>
          <ConfirmationModal
            data={{
              dialogTitle: confirmTitle,
              dialogSubtitle: confirmSubtitle,
              confirmButton: "Remove",
            }}
            onConfirm={handleConfirm}
            onCancel={() => setOpen(false)}
          />
        </Dialog>
      ) : null}
    </div>
  )
}
