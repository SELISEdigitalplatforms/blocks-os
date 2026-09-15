import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

/**
 * Collapsed-by-default view of a log's exception. Renders nothing when the log carried no
 * exception -- including the whitespace-only value the live tail returns, which blanks the
 * field server-side rather than omitting it.
 *
 * Shared by the logs list and the trace-details log panel so both read the same way.
 */
export const LogStackTrace = ({ exception }: { exception?: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const stackTrace = exception?.trim() ?? "";

  if (!stackTrace) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-error hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight
          aria-hidden="true"
          className={`h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${
            isOpen ? "rotate-90" : ""
          }`}
        />
        {isOpen ? "Hide stack trace" : "Show stack trace"}
      </button>

      {isOpen && (
        <div className="mt-2 rounded-sm border border-border bg-muted/40">
          <div className="flex items-center border-b border-border px-3 py-1.5">
            <CopyToClipboardButton textToCopy={stackTrace} label="Copy stack trace">
              <span className="text-xs font-medium uppercase tracking-wide text-medium-emphasis">
                Exception
              </span>
            </CopyToClipboardButton>
          </div>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words px-3 py-2 font-sans text-xs leading-relaxed text-medium-emphasis">
            {stackTrace}
          </pre>
        </div>
      )}
    </div>
  );
};
