import { useGetAllServices } from "@blocks-identifier/hooks/use-services";
import { useGetBlocksServices } from "@blocks-lmt/hooks/use-log";
import { LogsViewer, type Service } from "@blocks-lmt/components";
import {
  LOG_SERVICE_AI_DESCRIPTION,
  LOG_SERVICE_AI_QUERIES,
} from "@blocks-lmt/constants/logs-service-meta.constant";
import { createParser, useQueryState } from "nuqs";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useMemo } from "react";

type LogSource = "blocks" | "managed";

const SOURCE_OPTIONS: { label: string; value: LogSource }[] = [
  { label: "Managed Service", value: "blocks" },
  { label: "My Service", value: "managed" },
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
  const [source] = useQueryState<LogSource>("source", parseAsLogSource.withDefault("blocks"));
  // Cold and archive rows belong to a restore of this project, so the viewer needs to know
  // which project's restore to look up.
  const projectKey = useProjectStore().selectedProject?.tenantId || "";
  const { data: managedServicesData, isLoading, isFetching } = useGetAllServices({
    page: 0,
    pageSize: 1000,
  });
  const { data: blocksServicesData, isLoading: isBlocksServicesLoading } = useGetBlocksServices();

  const managedServices = useMemo<Service[]>(
    () =>
      managedServicesData?.data.map((service) => ({
        id: service.serviceId,
        // The service id suffix disambiguates same-named services registered
        // by different projects/environments.
        label: `${service.name} (${service.serviceId.slice(0, 10)})`,
        serviceName: service.serviceId,
        serviceNames: [service.serviceId],
        // Store the RegisteredService data so we can use it later for name mapping
        _raw: service,
      })) ?? [],
    [managedServicesData?.data],
  );

  const blocksServices = useMemo<Service[]>(
    () =>
      [...(blocksServicesData ?? [])]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((service) => ({
          id: service.key,
          label: service.label,
          serviceName: service.apiServiceName,
          serviceNames: [service.apiServiceName, ...service.workerServiceNames],
          components: [
            { label: "API", value: service.apiServiceName },
            // A raw technical name is used instead of a guessed friendly label
            // whenever a service has more than one worker (only "OS" does today),
            // since there's no reliable way to tell them apart otherwise.
            ...service.workerServiceNames.map((name) => ({
              label: service.workerServiceNames.length > 1 ? name : "Worker",
              value: name,
            })),
          ],
        })),
    [blocksServicesData],
  );

  const services = source === "blocks" ? blocksServices : managedServices;
  const isServicesLoading =
    source === "blocks" ? isBlocksServicesLoading : isLoading || isFetching;
  const predefinedQueries = source === "blocks" ? Object.values(LOG_SERVICE_AI_QUERIES).flat() : [];

  return (
    <div className="flex flex-col gap-5 sm:gap-4">
      <LogsViewer
        key={source}
        services={services}
        projectKey={projectKey}
        predefinedQueries={predefinedQueries}
        askAiDescription={LOG_SERVICE_AI_DESCRIPTION}
        agentName="Ask AI"
        useGenericTraceLinks
        isSourceBlocks={source === "blocks"}
        isServicesLoading={isServicesLoading}
      />
    </div>
  );
}
