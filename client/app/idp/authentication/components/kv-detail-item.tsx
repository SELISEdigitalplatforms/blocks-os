import { MouseEvent, useState } from "react"
import { Check, Copy, Eye, EyeOff } from "lucide-react"
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button"
import { MaskedText } from "@/components/masked-text"
import { Button } from "@/components/ui-kits/button/button"

interface KVDetailItemProps {
  label: string
  value: string
  copyable?: boolean
  sensitive?: boolean
}

const SENSITIVE_MASK_LENGTH = 30

const copyTextToClipboard = async (text: string) => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textArea = document.createElement("textarea")
  textArea.value = text
  textArea.style.position = "fixed"
  textArea.style.left = "-999999px"
  textArea.style.top = "-999999px"
  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()
  document.execCommand("copy")
  document.body.removeChild(textArea)
}

export const KVDetailItem = ({
  label,
  value,
  copyable = false,
  sensitive = false,
}: KVDetailItemProps) => {
  const [revealed, setRevealed] = useState(false)
  const [isCopying, setIsCopying] = useState(false)

  const handleCopy = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (isCopying || !value) return

    try {
      setIsCopying(true)
      await copyTextToClipboard(value)
    } catch (error) {
      console.error("Failed to copy:", error)
      setIsCopying(false)
      return
    }

    setTimeout(() => {
      setIsCopying(false)
    }, 1000)
  }

  const renderValue = () => {
    if (!value) {
      return <span className="italic text-muted-foreground">empty</span>
    }

    if (sensitive) {
      return (
        <span className="inline-flex items-center gap-1">
          {revealed ? (
            <span className="break-all text-high-emphasis">{value}</span>
          ) : (
            <MaskedText text={value} length={SENSITIVE_MASK_LENGTH} />
          )}
          <Button
            type="button"
            variant="ghost"
            className="h-auto shrink-0 p-1 text-muted-foreground hover:text-high-emphasis"
            aria-label={revealed ? "Hide value" : "Show value"}
            onClick={() => setRevealed((current) => !current)}
          >
            {revealed ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-auto shrink-0 p-1 text-gray-600 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Copy value"
            disabled={isCopying}
            onClick={handleCopy}
          >
            {isCopying ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </span>
      )
    }

    if (!copyable) {
      return <span className="break-all text-high-emphasis">{value}</span>
    }

    return (
      <CopyToClipboardButton textToCopy={value} isHoverable>
        <span className="break-all text-high-emphasis">{value}</span>
      </CopyToClipboardButton>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-1 overflow-hidden sm:flex-row sm:items-start sm:gap-4">
      <span className="shrink-0 font-mono text-xs text-muted-foreground sm:w-44 md:w-56">
        {label}
      </span>
      <div
        className={
          sensitive
            ? "min-w-0 font-mono text-xs"
            : "min-w-0 flex-1 font-mono text-xs"
        }
      >
        {renderValue()}
      </div>
    </div>
  )
}
