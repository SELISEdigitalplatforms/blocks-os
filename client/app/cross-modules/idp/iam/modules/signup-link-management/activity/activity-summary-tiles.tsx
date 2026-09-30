import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import { ISignupLinkSummary } from "@blocks-idp/iam/models/signup-link-summary";
import { HelpCircle } from "lucide-react";

type ActivitySummaryTilesProps = {
  summary: ISignupLinkSummary;
  rangeLabel: string;
  dimmed?: boolean;
};

export const usedPercentageCaption = (used: number, totalGenerated: number): string | null => {
  if (totalGenerated <= 0) return null;
  const pct = Math.round((used / totalGenerated) * 100);
  return `${pct}% of generated`;
};

export const ActivitySummaryTilesSkeleton = () => (
  <div
    className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    data-testid="activity-tiles-loading"
  >
    {Array.from({ length: 3 }).map((_, index) => (
      <Skeleton key={index} className="h-[120px] w-full rounded-xl" />
    ))}
  </div>
);

export const ActivitySummaryTiles = ({
  summary,
  rangeLabel,
  dimmed = false,
}: ActivitySummaryTilesProps) => {
  const usedCaption = usedPercentageCaption(summary.used, summary.totalGenerated);
  const neverUsedCaption = `${summary.neverUsedBreakdown.active} still active · ${summary.neverUsedBreakdown.expired} expired · ${summary.neverUsedBreakdown.revoked} revoked`;

  return (
    <div className={dimmed ? "opacity-50" : undefined} data-testid="activity-tiles">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-1 pt-6">
            <p className="text-sm text-muted-foreground">Generated</p>
            <p className="text-3xl font-semibold text-high-emphasis" data-testid="tile-generated">
              {summary.totalGenerated}
            </p>
            <p className="text-xs text-muted-foreground">{rangeLabel}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-1 pt-6">
            <p className="text-sm text-muted-foreground">Used</p>
            <p className="text-3xl font-semibold text-high-emphasis" data-testid="tile-used">
              {summary.used}
            </p>
            {usedCaption && <p className="text-xs text-muted-foreground">{usedCaption}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-1 pt-6">
            <div className="flex items-center gap-1.5">
              <p className="text-sm text-muted-foreground">Never used</p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground"
                      aria-label="Never used help"
                      data-testid="never-used-help"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    A link counts as used only when someone completed signup with it. A link that
                    was opened but abandoned counts as never used.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-3xl font-semibold text-high-emphasis" data-testid="tile-never-used">
              {summary.neverUsed}
            </p>
            <p className="text-xs text-muted-foreground">{neverUsedCaption}</p>
          </CardContent>
        </Card>
      </div>

      {summary.rejectedAttempts > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <p
                className="mt-3 cursor-default text-sm text-muted-foreground"
                data-testid="rejected-attempts"
              >
                {summary.rejectedAttempts} rejected attempts
              </p>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Someone opened a link that was already expired, revoked or used.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
};
