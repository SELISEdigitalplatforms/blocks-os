import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import { NOTIFICATION_TEXT } from "../constants/notification-ui.constant";

/** "Recipients" merges the old Send to and Receivers columns; the tooltip says what each value means. */
export function RecipientsHeader() {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{NOTIFICATION_TEXT.columns.recipients}</span>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-medium-emphasis"
              aria-label={NOTIFICATION_TEXT.recipientsHelpLabel}
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-80 border-none bg-neutral-500 text-white shadow-none">
            <ul className="space-y-1 text-xs">
              {NOTIFICATION_TEXT.recipientsHelp.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  );
}
