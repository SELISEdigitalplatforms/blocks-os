import { PageHeader } from "@/components/page-header/page-header";
import { Button } from "@/components/ui-kits/button/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { LMT_NAV_GROUPS } from "@/constants/lmt-nav";
import { useLmtBasePath } from "@/hooks/use-lmt-base-path";
import { cn } from "@/lib/utils";
import { useUsagesMetrics } from "@blocks-lmt/hooks/use-usage";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import { RefreshCcw } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { Outlet, useLocation } from "react-router-dom";

export default function LmtLayout() {
  const { pathname } = useLocation();
  const LMT_BASE_PATH = useLmtBasePath();
  const isLogsDetail = new RegExp(`^${LMT_BASE_PATH}/logs/[^/]+(/trace/[^/]+)?$`).test(pathname);
  const isTraceDetail = new RegExp(`^${LMT_BASE_PATH}/tracing/[^/]+$`).test(pathname);
  const isLmtDetail = isLogsDetail || isTraceDetail;
  const currentSegment = pathname.split("/").pop() ?? "usage";

  const tenantId = useProjectStore().selectedProject?.tenantId || "";

  const [timeRange, setTimeRange] = useQueryState("timeRange", parseAsString.withDefault("1h"));

  const { isLoading, isFetching, refetch } = useUsagesMetrics({ timeRange });

  const currentItem = LMT_NAV_GROUPS.flatMap((g) => g.items).find(
    (item) => item.value === currentSegment,
  );

  const headerActions =
    currentSegment === "usage" ? (
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
          disabled={isLoading || isFetching || !tenantId}
        >
          <RefreshCcw
            className={cn("aspect-square w-4", (isLoading || isFetching) && "animate-spin")}
          />
          <span className="sr-only sm:not-sr-only sm:ml-2">Refresh</span>
        </Button>
      </div>
    ) : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
        {currentItem && !isLmtDetail && currentSegment !== "tracing" && (
          <PageHeader
            title={currentItem.label}
            description={currentItem.desc}
            actions={headerActions}
          />
        )}
        <Outlet />
      </div>
    </div>
  );
}
