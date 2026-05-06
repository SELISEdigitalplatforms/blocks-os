
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { abbreviateBytes, abbreviateDurationMs, abbreviateNumber } from "../../utils/usage.util";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { UsageMatrixSummary } from "../../models/usage.model";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { Info, Logs } from "lucide-react";
import { Link } from "react-router-dom";

interface ServiceCardProps {
  isLoading: boolean;
  name: string;
  logLink?: string;
  metrics: {
    api: UsageMatrixSummary;
    worker: UsageMatrixSummary;
  };
}

const UsageServiceCardSkelton = ({ name }: { name: string }) => (
  <Card className="border shadow-none">
    <CardContent className="p-4">
      <div className="mb-4 flex items-start justify-between">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-high-emphasis">{name}</div>
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-7 w-28 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-[72px] rounded-lg" />
        <Skeleton className="h-[72px] rounded-lg" />
      </div>
      <div className="mt-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    </CardContent>
  </Card>
);

export const UsageServiceCard: React.FC<ServiceCardProps> = ({
  name,
  logLink,
  metrics,
  isLoading,
}) => {
  const [selected, setSelected] = useState<"api" | "worker">("api");

  if (isLoading) return <UsageServiceCardSkelton name={name} />;

  const currentMatrix = metrics[selected];

  return (
    <Card className="border shadow-none transition-shadow duration-200 hover:shadow-sm">
      <CardContent className="p-4">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-high-emphasis">{name}</div>
            <div className="mt-0.5 text-xs text-medium-emphasis">Requests &amp; performance</div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Select value={selected} onValueChange={(v) => setSelected(v as "api" | "worker")}>
              <SelectTrigger className="h-7 w-24 rounded-lg border-border/70 bg-muted/40 px-2 text-xs shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="api" className="text-xs">API</SelectItem>
                <SelectItem value="worker" className="text-xs">Worker</SelectItem>
              </SelectContent>
            </Select>
            {logLink ? (
              <Link
                to={logLink}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/70 bg-muted/40 text-medium-emphasis transition-colors hover:bg-background hover:text-high-emphasis hover:shadow-sm"
                title="View logs"
              >
                <Logs className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <div
                className="flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-lg border border-dashed border-border/70 text-muted-foreground opacity-50"
                title="Logs unavailable"
              >
                <Logs className="h-3.5 w-3.5" />
              </div>
            )}
          </div>
        </div>

        {/* Primary metrics */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col justify-between rounded-lg bg-muted/40 p-3">
            <span className="text-xs text-medium-emphasis">API Calls</span>
            <div>
              <div className="text-xl font-bold text-high-emphasis">
                {abbreviateNumber(currentMatrix.TotalRequests)}
              </div>
              {selected === "api" && (
                <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                  <span className="font-medium text-green-600">
                    {currentMatrix.successRate}% ok
                  </span>
                  <span className="text-border">·</span>
                  <span className="font-medium text-red-500">
                    {currentMatrix.errorRate}% err
                  </span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 cursor-pointer text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-1">
                            <div className="text-xs font-semibold">Success</div>
                            {[["1xx", currentMatrix.Status1xx], ["2xx", currentMatrix.Status2xx], ["3xx", currentMatrix.Status3xx]].map(([k, v]) => (
                              <div key={k} className="flex justify-between gap-4 text-xs">
                                <span className="text-muted-foreground">{k}</span>
                                <span>{abbreviateNumber(v as number)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs font-semibold">Errors</div>
                            {[["4xx", currentMatrix.Status4xx], ["5xx", currentMatrix.Status5xx]].map(([k, v]) => (
                              <div key={k} className="flex justify-between gap-4 text-xs">
                                <span className="text-muted-foreground">{k}</span>
                                <span>{abbreviateNumber(v as number)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-lg bg-muted/40 p-3">
            <span className="text-xs text-medium-emphasis">Avg Duration</span>
            <div className="text-xl font-bold text-high-emphasis">
              {abbreviateDurationMs(currentMatrix.AverageDuration)}
            </div>
          </div>
        </div>

        {/* Secondary metrics */}
        <div className="mt-3 divide-y divide-border/50">
          {[
            { label: "Calls / min", value: String(currentMatrix.callsPerMinute) },
            { label: "Peak Response", value: abbreviateDurationMs(currentMatrix.PeakDuration) },
            { label: "Throughput", value: abbreviateBytes(currentMatrix.TotalThroughput || 0) },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-1.5">
              <span className="text-xs text-medium-emphasis">{label}</span>
              <span className="text-xs font-semibold text-high-emphasis">{value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

