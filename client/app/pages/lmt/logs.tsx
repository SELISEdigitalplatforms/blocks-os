import { PageHeader } from "@/components/page-header/page-header";
import { LMTQueryAgentSheet } from "@blocks-ai/components/lmt-query-agent/lmt-query-agent-sheet";
import { useGetAllServices } from "@blocks-identifier/hooks/use-services";
import { useGetBlocksServices } from "@blocks-lmt/hooks/use-log";
import { LogsViewer, type Service } from "@blocks-lmt/components";
import {
  LOG_SERVICE_AI_DESCRIPTION,
  LOG_SERVICE_AI_QUERIES,
} from "@blocks-lmt/constants/logs-service-meta.constant";
import { useLogsTier } from "@blocks-lmt/hooks/use-logs-tier";
import { TRACE_PROVIDERS } from "@blocks-lmt/constants/trace.constant";
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
  // The agent sits in the page header, where Tracing's does. It queries hot storage, so over a
  // restore it would answer about days other than the ones on screen and is withheld there.
  const { tier } = useLogsTier(Boolean(projectKey));
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
        .flatMap((service) => {
          // The API and each worker are listed as separate services rather than as
          // children of one group, and only the parts a service actually has are offered.
          const apiServiceName = service.apiServiceName || "";
          const workerServiceNames = (service.workerServiceNames ?? []).filter(Boolean);
          const toService = (id: string, label: string, name: string): Service => ({
            id,
            label,
            serviceName: name,
            serviceNames: [name],
          });
          return [
            ...(apiServiceName
              ? [toService(`${service.key}-api`, `${service.label} API`, apiServiceName)]
              : []),
            // A raw technical name is used instead of a guessed friendly label whenever
            // a service has more than one worker, since there's no reliable way to tell
            // them apart otherwise.
            ...workerServiceNames.map((name) =>
              workerServiceNames.length > 1
                ? toService(name, `${service.label} ${name}`, name)
                : toService(`${service.key}-worker`, `${service.label} Worker`, name),
            ),
          ];
        }),
    [blocksServicesData],
  );

  const services = source === "blocks" ? blocksServices : managedServices;
  const isServicesLoading =
    source === "blocks" ? isBlocksServicesLoading : isLoading || isFetching;
  const predefinedQueries = source === "blocks" ? Object.values(LOG_SERVICE_AI_QUERIES).flat() : [];

  return (
    <>
      <PageHeader
        title="Logs"
        description="Search and view application logs across your services"
        actions={
          tier === TRACE_PROVIDERS.hot ? (
            <LMTQueryAgentSheet
              description={LOG_SERVICE_AI_DESCRIPTION}
              questions={predefinedQueries}
            />
          ) : undefined
        }
      />
      <div className="flex flex-col gap-5 sm:gap-4">
        <LogsViewer
          key={source}
          services={services}
          projectKey={projectKey}
          predefinedQueries={predefinedQueries}
          askAiDescription={LOG_SERVICE_AI_DESCRIPTION}
          showAgent={false}
          useGenericTraceLinks
          isSourceBlocks={source === "blocks"}
          isServicesLoading={isServicesLoading}
        />
      </div>
    </>
  );
}
