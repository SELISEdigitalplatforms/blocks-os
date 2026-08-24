import { Button } from "@/components/ui-kits/button/button";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { copyText } from "./copy-text";

type CopyButtonProps = {
  text: string;
  /** Accessible name — icon-only buttons have nothing else to announce. */
  label: string;
  /** Renders the label next to the icon instead of visually hiding it. */
  showLabel?: boolean;
  variant?: "ghost" | "outline" | "default";
  className?: string;
  onCopied?: (succeeded: boolean) => void;
};

export const CopyButton = ({
  text,
  label,
  showLabel = false,
  variant = "ghost",
  className,
  onCopied,
}: CopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const handleCopy = async () => {
    const succeeded = await copyText(text);
    setIsCopied(succeeded);
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setIsCopied(false), 1500);
    onCopied?.(succeeded);
  };

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      aria-label={label}
      title={label}
      onClick={handleCopy}
      className={cn("gap-1.5", showLabel ? "" : "h-8 w-8 p-0", className)}
    >
      {isCopied ? (
        <Check className="h-4 w-4 text-success" aria-hidden="true" />
      ) : (
        <Copy className="h-4 w-4" aria-hidden="true" />
      )}
      {showLabel ? <span>{isCopied ? "Copied" : label}</span> : null}
    </Button>
  );
};
