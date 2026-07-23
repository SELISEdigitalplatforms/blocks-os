import { BLOCKS_LOG_SERVICES } from "@/cross-modules/lmt/constants/logs.constant";
import { useGetAllServices } from "@blocks-identifier/hooks/use-services";
import { LogsViewer, type Service } from "@blocks-lmt/components";
import {
  LOG_SERVICE_AI_DESCRIPTION,
  LOG_SERVICE_AI_QUERIES,
} from "@blocks-lmt/constants/logs-service-meta.constant";
import { createParser, useQueryState } from "nuqs";
import { useMemo } from "react";

type LogSource = "blocks" | "managed";

const BLOCKS_SERVICES: Service[] = BLOCKS_LOG_SERVICES.map((service) => ({
  id: service.id,
  label: service.label,
  serviceName: service.id,
  serviceNames: service.serviceNames,
  icon: service.icon,
}));

const SOURCE_OPTIONS: { label: string; value: LogSource }[] = [
  { label: "Blocks services", value: "blocks" },
  { label: "Managed services", value: "managed" },
];

export const parseAsLogSource = createParser({
  parse(value: string) {
    if (SOURCE_OPTIONS.some((option) => option.value === value)) {
      return value as LogSource;
    }
    return null;
  },
  serialize(value: LogSource) {
    return value;
  },
});
export function LogsRoute() {
  const [source] = useQueryState<LogSource>(
    "source",
    parseAsLogSource.withDefault("blocks"),
  );
  const { data, isLoading, isFetching } = useGetAllServices({
    page: 0,
    pageSize: 1000,
  });

  const managedServices = useMemo<Service[]>(
    () =>
      data?.data.map((service) => ({
        id: service.serviceId,
        label: service.name,
        serviceName: service.serviceId,
        serviceNames: [service.serviceId],
        // Store the RegisteredService data so we can use it later for name mapping
        _raw: service,
      })) ?? [],
    [data?.data],
  );

  const services = source === "blocks" ? BLOCKS_SERVICES : managedServices;
  const isManagedLoading = source === "managed" && (isLoading || isFetching);
  const predefinedQueries =
    source === "blocks" ? Object.values(LOG_SERVICE_AI_QUERIES).flat() : [];

  return (
    <div className="flex flex-col gap-5 sm:gap-4">
      <LogsViewer
        key={source}
        services={services}
        predefinedQueries={predefinedQueries}
        askAiDescription={LOG_SERVICE_AI_DESCRIPTION}
        agentName="Ask AI"
        useGenericTraceLinks
        isSourceBlocks={source === "blocks"}
        isManagedLoading={isManagedLoading}
      />
    </div>
  );
}
