import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { cn } from "@/lib/utils";

interface CopyValueButtonProps {
  value: string;
  /** What is being copied, for screen readers and the tooltip ("Copy host"). */
  label: string;
  className?: string;
}

export const CopyValueButton = ({ value, label, className }: CopyValueButtonProps) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard access denied: the value stays visible to copy by hand
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={label}
      aria-label={copied ? "Copied" : label}
      onClick={handleCopy}
      className={cn("h-8 w-8 shrink-0 text-muted-foreground", className)}
    >
      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
};
