import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs";
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
  const [source, setSource] = useQueryState<LogSource>(
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
      })) ?? [],
    [data?.data],
  );

  const services = source === "blocks" ? BLOCKS_SERVICES : managedServices;
  const isManagedLoading = source === "managed" && (isLoading || isFetching);
  const predefinedQueries =
    source === "blocks" ? Object.values(LOG_SERVICE_AI_QUERIES).flat() : [];

  return (
    <div className="flex flex-col gap-5 sm:gap-4">
      <Tabs
        value={source}
        onValueChange={(value) => setSource(value as LogSource)}>
        <TabsList className="h-[42px] bg-blocks-primary-shades-300">
          {SOURCE_OPTIONS.map((option) => (
            <TabsTrigger
              key={option.value}
              value={option.value}
              className="h-8 w-fit">
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isManagedLoading ? (
        <Card>
          <CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            Loading managed services...
          </CardContent>
        </Card>
      ) : source === "managed" && services.length === 0 ? (
        <Card>
          <CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No managed services found.
          </CardContent>
        </Card>
      ) : (
        <LogsViewer
          key={source}
          services={services}
          predefinedQueries={predefinedQueries}
          askAiDescription={LOG_SERVICE_AI_DESCRIPTION}
          agentName="Ask AI"
          useGenericTraceLinks
        />
      )}
    </div>
  );
}
