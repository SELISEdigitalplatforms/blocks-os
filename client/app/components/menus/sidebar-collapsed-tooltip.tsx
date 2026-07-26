import { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui-kits/tooltip/tooltip";

export const sidebarCollapsedTooltipClass =
  "border-none bg-gray-300 px-2 py-1 text-xs font-normal text-primary shadow-none";

type SidebarCollapsedTooltipProps = {
  label: string;
  show: boolean;
  children: ReactNode;
};

export function SidebarCollapsedTooltip({ label, show, children }: SidebarCollapsedTooltipProps) {
  if (!show) {
    return <>{children}</>;
  }

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="right"
        align="center"
        sideOffset={8}
        className={sidebarCollapsedTooltipClass}
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
