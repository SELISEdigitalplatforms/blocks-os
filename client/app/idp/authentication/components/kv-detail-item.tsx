import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { Button } from "@/components/ui-kits/button/button";

interface KVDetailItemProps {
  label: string;
  value: string;
  copyable?: boolean;
  secret?: boolean;
}

export const KVDetailItem = ({
  label,
  value,
  copyable = false,
  secret = false,
}: KVDetailItemProps) => {
  const [revealed, setRevealed] = useState(false);

  const renderValue = () => {
    if (!value) {
      return <span className="italic text-muted-foreground">empty</span>;
    }

    if (secret) {
      return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="break-all text-high-emphasis">
            {revealed ? value : "*".repeat(Math.min(value.length, 36))}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1 text-muted-foreground hover:text-high-emphasis"
              aria-label={revealed ? "Hide value" : "Show value"}
              onClick={() => setRevealed((r) => !r)}
            >
              {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            {copyable && (
              <CopyToClipboardButton textToCopy={value}>
                <span />
              </CopyToClipboardButton>
            )}
          </div>
        </div>
      );
    }

    if (!copyable) {
      return <span className="break-all text-high-emphasis">{value}</span>;
    }

    return (
      <CopyToClipboardButton textToCopy={value} isHoverable>
        <span className="break-all text-high-emphasis">{value}</span>
      </CopyToClipboardButton>
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-1 overflow-hidden sm:flex-row sm:items-start sm:gap-4">
      <span className="shrink-0 font-mono text-xs text-muted-foreground sm:w-44 md:w-56">
        {label}
      </span>
      <div className="min-w-0 flex-1 font-mono text-xs">{renderValue()}</div>
    </div>
  );
};
