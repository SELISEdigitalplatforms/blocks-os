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
}

export const SettingsDismissibleChip = ({
  title,
  subtitle,
  confirmTitle,
  confirmSubtitle,
  onDismiss,
  className,
  readOnly = false,
}: SettingsDismissibleChipProps) => {
  const [open, setOpen] = useState(false)

  const handleConfirm = () => {
    onDismiss()
    setOpen(false)
  }

  return (
    <div
      className={cn(
        "relative rounded-lg border bg-card p-4 pr-10 shadow-sm",
        className,
      )}
    >
      <p className="truncate text-sm font-semibold text-foreground" title={title}>
        {title}
      </p>
      {subtitle ? (
        <p className="mt-1 truncate text-xs text-muted-foreground" title={subtitle}>
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
              className="absolute right-1.5 top-1.5 h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${title}`}
            >
              <X className="h-3.5 w-3.5" />
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
