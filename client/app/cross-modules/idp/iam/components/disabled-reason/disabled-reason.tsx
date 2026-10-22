import { ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";

type DisabledReasonProps = {
  /** Why the control is off. Empty or null means it is on and children render untouched. */
  reason?: string | null;
  children: ReactNode;
};

/**
 * Explains a disabled control. A disabled button gets no pointer events, so the tooltip hangs on a
 * focusable wrapper around it instead.
 */
export const DisabledReason = ({ reason, children }: Readonly<DisabledReasonProps>) => {
  if (!reason) return children;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex" tabIndex={0} data-testid="disabled-reason">
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">{reason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
