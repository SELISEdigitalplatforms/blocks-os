import { Button } from "@/components/ui-kits/button/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui-kits/card/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/store/useProjectStore";
import {
  CircleAlert,
  CircleCheck,
  Clock,
  Network,
  RefreshCcw,
  Menu,
  ChevronsLeft,
} from "lucide-react";
import { useQueryState, parseAsString } from "nuqs";
import { useState } from "react";
import { LMTQueryAgentSheet } from "@blocks-ai/components/lmt-query-agent/lmt-query-agent-sheet";
import { UsageServiceCard, UsageSummaryCard } from "@blocks-lmt/components";
import {
  USAGES_SERVICE_MAP,
  type UsageServiceMap,
} from "@blocks-lmt/constants/usage.constant";
import { useUsagesMetrics } from "@blocks-lmt/hooks/use-usage";
import {
  abbreviateDurationMs,
  abbreviateNumber,
  defaultUsagesMetrics,
} from "@blocks-lmt/utils";
import { TracesOverview } from "@blocks-lmt/components/traces-overview/traces-overview";
import { LMT_NAV_GROUPS } from "@/constants/lmt-nav";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui-kits/sheet/sheet";
export default function LmtPage() {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsString.withDefault("usage"),
  );
  const [timeRange, setTimeRange] = useState("1h");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { data, isLoading, isFetching, refetch } = useUsagesMetrics({ timeRange });
  const defaultUsageData = {
    api: defaultUsagesMetrics,
    worker: defaultUsagesMetrics,
  };
  const currentItem = LMT_NAV_GROUPS.flatMap((g) => g.items).find(
    (item) => item.value === (activeTab ?? "usage"),
  );
  const headerActions = (
    <>
      {activeTab === "usage" && (
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
              className={cn(
                "aspect-square w-4",
                (isLoading || isFetching) && "animate-spin",
              )}
            />
            <span className="sr-only sm:not-sr-only sm:ml-2">Refresh</span>
          </Button>
        </div>
      )}
      {activeTab === "tracing" && (
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
          <Sheet
            open={isMobileSidebarOpen}
            onOpenChange={setIsMobileSidebarOpen}
          >
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-52 p-0" hideClose>
              <div className="flex h-full flex-col">
                <SheetHeader className="flex-row items-center justify-between border-b border-border px-4 py-3">
                  <SheetTitle className="text-sm font-semibold">LMT</SheetTitle>
                  <SheetClose asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="!mt-0 h-7 w-7 shrink-0"
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                  </SheetClose>
                </SheetHeader>
                <nav className="flex-1 overflow-y-auto py-1">
                  {LMT_NAV_GROUPS.map((group) => (
                    <div key={group.label}>
                      <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {group.label}
                      </p>
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = (activeTab ?? "usage") === item.value;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setActiveTab(item.value);
                              setIsMobileSidebarOpen(false);
                            }}
                            className={cn(
                              "relative flex h-10 w-full items-center gap-3 px-4 py-1.5 text-sm transition-colors",
                              isActive
                                ? "text-primary"
                                : "text-[hsl(var(--low-emphasis))] hover:text-[hsl(var(--high-emphasis))]",
                            )}
                          >
                            <Icon className="h-5 w-5 shrink-0" />
                            <span>{item.label}</span>
                            {isActive && (
                              <div className="absolute right-0 top-2.5 h-5 w-1 rounded-l-lg bg-primary" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </nav>
              </div>
            </SheetContent>
          </Sheet>
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
        {activeTab === "usage" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Global overview</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <UsageSummaryCard
                  description="Total API calls"
                  title={data ? abbreviateNumber(data.accumulatedApiCall) : ""}
                  isLoading={isLoading || isFetching}
                  Icon={Network}
                />
                <UsageSummaryCard
                  description="Average response time"
                  title={
                    data
                      ? abbreviateDurationMs(data.accumulatedAverageDuration)
                      : ""
                  }
                  isLoading={isLoading || isFetching}
                  Icon={Clock}
                  className="bg-blocks-secondary-50 text-blocks-secondary-600"
                />
                <UsageSummaryCard
                  description="Successful calls"
                  title={data ? abbreviateNumber(data.accumulatedSuccess) : ""}
                  isLoading={isLoading || isFetching}
                  className="bg-green-50 text-green-600"
                  Icon={CircleCheck}
                />
                <UsageSummaryCard
                  description="Total errors"
                  title={data ? abbreviateNumber(data.accumulatedError) : ""}
                  isLoading={isLoading || isFetching}
                  className="bg-red-50 text-red-600"
                  Icon={CircleAlert}
                />
              </CardContent>
            </Card>
            {tenantId ? (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {(
                    Object.keys(USAGES_SERVICE_MAP) as Array<
                      keyof UsageServiceMap
                    >
                  ).map((item) => (
                    <UsageServiceCard
                      key={item}
                      name={USAGES_SERVICE_MAP[item].label}
                      logLink={`/services/lmt/logs/${item}`}
                      isLoading={isLoading || isFetching}
                      metrics={data?.services[item] ?? defaultUsageData}
                    />
                  ))}
                </div>
                {data && (
                  <div className="border-t pt-4 text-center text-xs text-medium-emphasis">
                    Last updated: {new Date(data.endTime).toLocaleDateString()}{" "}
                    at {new Date(data.endTime).toLocaleTimeString()}
                  </div>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  Select a project to load LMT usage data.
                </CardContent>
              </Card>
            )}
          </div>
        )}
        {activeTab === "tracing" &&
          (tenantId ? (
            <TracesOverview projectKey={tenantId} />
          ) : (
            <Card>
              <CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                Select a project to load tracing data.
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}
