import { useQuery } from "@tanstack/react-query";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { lmtService } from "../services/lmt.service";
import {
  IGetOperationalAnalyticsPayload,
  IGetServiceAnalyticsPayload,
} from "../models/usage.model";
import { getNormalizeUsageMetricsData } from "../utils/usage.util";

export const useGetOperationalAnalytics = (option: IGetOperationalAnalyticsPayload) => {
  return useQuery({
    queryKey: ["usage-operation", option],
    queryFn: () => lmtService.usage.getOperationalAnalytics(option),
  });
};

// Unlike the operational-analytics payload, IGetServiceAnalyticsPayload carries no
// projectKey — the endpoint resolves the tenant from the request token. The active
// tenant must be in the query key, otherwise switching projects serves the previous
// project's cache until a reload.
export const useGetServiceAnalytics = (option: IGetServiceAnalyticsPayload) => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  return useQuery({
    queryKey: ["usage-service", tenantId, option],
    queryFn: () => lmtService.usage.getServiceAnalytics(option),
    enabled: !!tenantId,
  });
};

export const useUsagesMetrics = (option: { timeRange: string }) => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  return useQuery({
    queryKey: ["usage-metrics", tenantId, option],
    enabled: !!tenantId,
    queryFn: async () => {
      const now = new Date();
      let startTime: Date;

      switch (option.timeRange) {
        case "1h":
          startTime = new Date(now.getTime() - 1 * 60 * 60 * 1000);
          break;
        case "24h":
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      const payload = {
        startTime: startTime.toISOString(),
        endTime: now.toISOString(),
      };

      const res = await lmtService.usage.getServiceAnalytics(payload);
      return getNormalizeUsageMetricsData(res, payload);
    },
  });
};
