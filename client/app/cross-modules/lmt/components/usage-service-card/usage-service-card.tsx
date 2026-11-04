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
import { Link } from "react-router";
import { useT } from "@seliseblocks/genesis-os";
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
  const { t } = useT("os.lmt");
  const [selected, setSelected] = useState<"api" | "worker">("api");
  if (isLoading) return <UsageServiceCardSkelton name={name} />;
  const currentMatrix = metrics[selected];
  return (
    <Card className="border shadow-none transition-shadow duration-200 hover:shadow-xs">
      <CardContent className="p-4">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-high-emphasis">{name}</div>
            <div className="mt-0.5 text-xs text-medium-emphasis">
              {t("USAGE_SERVICE_CARD.REQUESTS_PERFORMANCE")}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Select value={selected} onValueChange={(v) => setSelected(v as "api" | "worker")}>
              <SelectTrigger className="h-7 w-24 rounded-lg border-border/70 bg-muted/40 px-2 text-xs shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="api" className="text-xs">
                  {t("USAGE_SERVICE_CARD.API")}
                </SelectItem>
                <SelectItem value="worker" className="text-xs">
                  {t("USAGE_SERVICE_CARD.WORKER")}
                </SelectItem>
              </SelectContent>
            </Select>
            {logLink ? (
              <Link
                to={logLink}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/70 bg-muted/40 text-medium-emphasis transition-colors hover:bg-background hover:text-high-emphasis hover:shadow-xs"
                title={t("USAGE_SERVICE_CARD.VIEW_LOGS")}
              >
                <Logs className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <div
                className="flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-lg border border-dashed border-border/70 text-muted-foreground opacity-50"
                title={t("USAGE_SERVICE_CARD.LOGS_UNAVAILABLE")}
              >
                <Logs className="h-3.5 w-3.5" />
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col justify-between rounded-lg bg-muted p-3">
            <span className="text-xs text-medium-emphasis">
              {t("USAGE_SERVICE_CARD.API_CALLS")}
            </span>
            <div>
              <div className="text-xl font-bold text-high-emphasis">
                {abbreviateNumber(currentMatrix.TotalRequests)}
              </div>
              {selected === "api" && (
                <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                  <span className="font-medium text-green-600">
                    {t("USAGE_SERVICE_CARD.OK", { successRate: currentMatrix.successRate })}
                  </span>
                  <span className="text-border">·</span>
                  <span className="font-medium text-red-500">
                    {t("USAGE_SERVICE_CARD.ERR", { errorRate: currentMatrix.errorRate })}
                  </span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 cursor-pointer text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-1">
                            <div className="text-xs font-semibold">{t("common:SUCCESS")}</div>
                            {[
                              ["1xx", currentMatrix.Status1xx],
                              ["2xx", currentMatrix.Status2xx],
                              ["3xx", currentMatrix.Status3xx],
                            ].map(([k, v]) => (
                              <div key={k} className="flex justify-between gap-4 text-xs">
                                <span className="text-muted-foreground">{k}</span>
                                <span>{abbreviateNumber(v as number)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs font-semibold">
                              {t("USAGE_SERVICE_CARD.ERRORS")}
                            </div>
                            {[
                              ["4xx", currentMatrix.Status4xx],
                              ["5xx", currentMatrix.Status5xx],
                            ].map(([k, v]) => (
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
          <div className="flex flex-col justify-between rounded-lg bg-muted p-3">
            <span className="text-xs text-medium-emphasis">
              {t("USAGE_SERVICE_CARD.AVG_DURATION")}
            </span>
            <div className="text-xl font-bold text-high-emphasis">
              {abbreviateDurationMs(currentMatrix.AverageDuration)}
            </div>
          </div>
        </div>
        <div className="mt-3 divide-y divide-border/50">
          {[
            {
              label: t("USAGE_SERVICE_CARD.CALLS_MIN"),
              value: String(currentMatrix.callsPerMinute),
            },
            {
              label: t("USAGE_SERVICE_CARD.PEAK_RESPONSE"),
              value: abbreviateDurationMs(currentMatrix.PeakDuration),
            },
            {
              label: t("USAGE_SERVICE_CARD.THROUGHPUT"),
              value: abbreviateBytes(currentMatrix.TotalThroughput || 0),
            },
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
