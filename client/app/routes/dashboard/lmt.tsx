import { Button } from "@/components/ui-kits/button/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { LMT_NAV_GROUPS } from "@/constants/lmt-nav";
import { cn } from "@/lib/utils";
import { LMTQueryAgentSheet } from "@blocks-ai/components/lmt-query-agent/lmt-query-agent-sheet";
import { useUsagesMetrics } from "@blocks-lmt/hooks/use-usage";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import { RefreshCcw } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { Outlet, useLocation } from "react-router-dom";

export default function LmtLayout() {
  const { pathname } = useLocation();
  const currentPath = pathname.split("/").pop() ?? "usage";

  const tenantId = useProjectStore().selectedProject?.tenantId || "";

  // Query param so the usage child route reads the same value without prop-drilling
  const [timeRange, setTimeRange] = useQueryState(
    "timeRange",
    parseAsString.withDefault("1h"),
  );

  // Layout only needs these three — the usage child calls the same hook and gets the
  // cached response from React Query (no duplicate network request)
  const { isLoading, isFetching, refetch } = useUsagesMetrics({ timeRange });

  const currentItem = LMT_NAV_GROUPS.flatMap((g) => g.items).find(
    (item) => item.value === currentPath,
  );

  const headerActions = (
    <>
      {currentPath === "usage" && (
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isFetching || !tenantId}>
            <RefreshCcw
              className={cn(
                "aspect-square w-4",
                (isLoading || isFetching) && "animate-spin",
              )}
            />
            <span className="sr-only sm:not-sr-only sm:ml-2">Refresh</span>
          </Button>
        </div>
      )}
      {currentPath === "tracing" && (
        <LMTQueryAgentSheet
          description="Hello! I can help you search and analyze your logs, metrics, and tracing data."
          questions={[
            "Show me traces for the last 1 hour",
            "Which services are generating the most traces",
            "Which traces had high latency today",
          ]}
        />
      )}
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          {currentItem && (
            <div>
              <h1 className="text-lg font-semibold text-[hsl(var(--high-emphasis))]">
                {currentItem.label}
              </h1>
              <p className="text-xs text-muted-foreground">
                {currentItem.desc}
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">{headerActions}</div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </div>
    </div>
  );
}
