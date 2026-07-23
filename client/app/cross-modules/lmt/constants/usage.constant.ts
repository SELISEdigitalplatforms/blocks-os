import { SERVICES } from "./services.constant";

const usageServices = SERVICES.filter((s) => s.showInUsage);

type UsageServiceMapKey = (typeof usageServices)[number]["name"];
type UsageServiceMapValue = {
  label: string;
  /** Analytics `_id` candidates for the API/service process. */
  apiNames: string[];
  /** Analytics `_id` for the worker process. */
  workerName: string;
};

export type UsageServiceMap = Record<UsageServiceMapKey, UsageServiceMapValue>;

export const USAGES_SERVICE_MAP: UsageServiceMap = usageServices.reduce(
  (acc, { name, label, serviceName }) => {
    acc[name] = {
      label,
      // Analytics returns either `blocks-{service}` or `blocks-{service}-api`
      apiNames: [`blocks-${serviceName}`, `blocks-${serviceName}-api`],
      workerName: `blocks-${serviceName}-worker`,
    };
    return acc;
  },
  {} as UsageServiceMap,
);
