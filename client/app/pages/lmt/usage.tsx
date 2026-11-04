import { UsageSummaryCard, UsageServiceCard } from "@/cross-modules/lmt/components";
import { USAGES_SERVICE_MAP, UsageServiceMap } from "@/cross-modules/lmt/constants/usage.constant";
import { useUsagesMetrics } from "@/cross-modules/lmt/hooks/use-usage";
import {
  defaultUsagesMetrics,
  abbreviateNumber,
  abbreviateDurationMs,
} from "@/cross-modules/lmt/utils";
import { useLmtBasePath } from "@/hooks/use-lmt-base-path";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  useProjectStore,
  useT,
} from "@seliseblocks/genesis-os";
import { Network, Clock, CircleCheck, CircleAlert } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";

// usage-route.tsx
export function UsageRoute() {
  const { t } = useT("os.lmt");
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const LMT_BASE_PATH = useLmtBasePath();
  const [timeRange] = useQueryState("timeRange", parseAsString.withDefault("1h"));
  const { data, isLoading, isFetching } = useUsagesMetrics({ timeRange });

  const defaultUsageData = {
    api: defaultUsagesMetrics,
    worker: defaultUsagesMetrics,
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("USAGE.GLOBAL_OVERVIEW")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <UsageSummaryCard
            description={t("USAGE.TOTAL_API_CALLS")}
            title={data ? abbreviateNumber(data.accumulatedApiCall) : ""}
            isLoading={isLoading || isFetching}
            Icon={Network}
          />
          <UsageSummaryCard
            description={t("USAGE.AVERAGE_RESPONSE_TIME")}
            title={data ? abbreviateDurationMs(data.accumulatedAverageDuration) : ""}
            isLoading={isLoading || isFetching}
            Icon={Clock}
            className="bg-blocks-secondary-50 text-blocks-secondary-600"
          />
          <UsageSummaryCard
            description={t("USAGE.SUCCESSFUL_CALLS")}
            title={data ? abbreviateNumber(data.accumulatedSuccess) : ""}
            isLoading={isLoading || isFetching}
            className="bg-green-50 text-green-600"
            Icon={CircleCheck}
          />
          <UsageSummaryCard
            description={t("USAGE.TOTAL_ERRORS")}
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
            {(Object.keys(USAGES_SERVICE_MAP) as Array<keyof UsageServiceMap>).map((item) => (
              <UsageServiceCard
                key={item}
                name={USAGES_SERVICE_MAP[item].label}
                logLink={`${LMT_BASE_PATH}/logs/${item}`}
                isLoading={isLoading || isFetching}
                metrics={data?.services[item] ?? defaultUsageData}
              />
            ))}
          </div>
          {data && (
            <div className="border-t pt-4 text-center text-xs text-medium-emphasis">
              {t("USAGE.LAST_UPDATED_AT", {
                value1: new Date(data.endTime).toLocaleDateString(),
                value2: new Date(data.endTime).toLocaleTimeString(),
              })}
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            {t("USAGE.SELECT_A_PROJECT_TO_LOAD")}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
