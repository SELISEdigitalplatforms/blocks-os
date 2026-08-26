import { PageHeader } from "@/components/page-header/page-header";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent, CardHeader } from "@/components/ui-kits/card/card";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { Tabs, TabsContent } from "@/components/ui-kits/tabs/tabs";
import { LMTQueryAgentSheet } from "@blocks-ai/components/lmt-query-agent/lmt-query-agent-sheet";
import { useIsMobile } from "@seliseblocks/genesis-os/hooks";
import { TraceProviderSetupGuideLine } from "@blocks-lmt/components/trace-guideline/trace-provider-guideline";
import { TRACE_PROVIDERS, TRACE_REQUEST_SOURCE_TYPE } from "@blocks-lmt/constants/trace.constant";
import { useGetBlocksServices, useGetTraces } from "@blocks-lmt/hooks/use-trace";
import { useQuery } from "@tanstack/react-query";
import { Archive, BookOpenText, Flame, Snowflake } from "lucide-react";
import { useMemo, useState } from "react";
import { serviceRegistryService } from "@/cross-modules/identifier/services/service-registry.service";
import { RestoredTracesTab } from "./restored-traces-tab";
import {
  ServiceOption,
  TracesFilterToolbar,
  useTraceSortQueryParams,
  useTracesFilterQueryParams,
} from "./traces-filter-toolbar";
import { TracesList } from "./traces-list";
type TracesOverviewProps = {
  projectKey: string;
};
/**
 * The service filter renders the same checkbox tree the logs page uses: a blocks
 * service is a parent (its key) and its API/worker collections are the children,
 * keyed "<serviceKey>::<collectionName>". A registered service has no children, so
 * its own value is already the collection name.
 */
const COMPONENT_PREFIX = "::";
/** Checkbox-tree option values -> the collection names the traces API filters on. */
const treeValuesToServiceNames = (treeValues: string[], options: ServiceOption[]) => {
  const names = treeValues.flatMap((treeValue) => {
    const [parent, component] = treeValue.split(COMPONENT_PREFIX);
    if (component) return [component];
    const option = options.find((item) => item.value === parent);
    // Values whose service is not (yet) in the list are dropped rather than sent as-is.
    if (!option) return [];
    return option.children?.length
      ? option.children.map((child) => child.value.split(COMPONENT_PREFIX)[1])
      : [option.value];
  });
  return [...new Set(names)];
};
const TRACE_MODE_OPTIONS = [
  {
    value: "hot",
    title: "Hot",
    description: "Live and recent traces for active debugging.",
    Icon: Flame,
  },
  {
    value: "cold",
    title: "Cold",
    description: "Longer-term stored traces for later investigation.",
    Icon: Snowflake,
  },
  {
    value: "archive",
    title: "Archive",
    description: "Deep history retained for audit and export use cases.",
    Icon: Archive,
  },
] as const;
export function TracesOverview({ projectKey }: TracesOverviewProps) {
  const isMobile = useIsMobile();
  const { queryParams, setQueryParams } = useTracesFilterQueryParams();
  const { sortQueryParams } = useTraceSortQueryParams();
  const tabId = (queryParams.tab || "hot") as keyof typeof TRACE_PROVIDERS;
  const [open, setOpen] = useState(false);
  const provider = TRACE_PROVIDERS[tabId] || TRACE_PROVIDERS.hot;
  const { data: registeredServices } = useQuery({
    queryKey: ["registered-services", projectKey],
    queryFn: () =>
      serviceRegistryService.getAllServices({
        page: 0,
        pageSize: 1000,
        filter: { serviceId: "", serviceName: "", serviceType: "" },
      }),
    enabled: !!projectKey,
  });
  const { data: blocksServicesData } = useGetBlocksServices();
  const serviceOptions = useMemo<ServiceOption[]>(() => {
    const blocksServices = [...(blocksServicesData ?? [])]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((service) => ({
        label: service.label,
        value: service.key,
        children: [
          { label: "API", value: `${service.key}${COMPONENT_PREFIX}${service.apiServiceName}` },
          // A raw technical name is used instead of a guessed friendly label
          // whenever a service has more than one worker (only "OS" does today),
          // since there's no reliable way to tell them apart otherwise.
          ...service.workerServiceNames.map((name) => ({
            label: service.workerServiceNames.length > 1 ? name : "Worker",
            value: `${service.key}${COMPONENT_PREFIX}${name}`,
          })),
        ],
      }));
    const registered = (registeredServices?.data ?? []).map((service) => ({
      label: service.name,
      value: service.serviceId,
    }));
    const merged: ServiceOption[] = [...blocksServices, ...registered];
    return merged.filter(
      (item, index, array) => array.findIndex((value) => value.value === item.value) === index,
    );
  }, [blocksServicesData, registeredServices?.data]);
  // The trace table's Service column shows a raw collection name (an api or a worker
  // one), so labels are resolved from a name -> label map rather than from the tree
  // options, whose child labels are only meaningful inside their own group.
  const serviceLabels = useMemo(() => {
    const labels = new Map<string, string>();
    for (const service of registeredServices?.data ?? []) {
      labels.set(service.serviceId, service.name);
    }
    // Blocks services are written last so they win a name collision, as before.
    for (const service of blocksServicesData ?? []) {
      labels.set(service.apiServiceName, service.label);
      for (const name of service.workerServiceNames) {
        labels.set(name, service.workerServiceNames.length > 1 ? name : `${service.label} Worker`);
      }
    }
    return labels;
  }, [blocksServicesData, registeredServices?.data]);
  const selectedServiceNames = useMemo(
    () => treeValuesToServiceNames(queryParams.services, serviceOptions),
    [queryParams.services, serviceOptions],
  );
  const { data, isLoading, isFetching } = useGetTraces({
    page: queryParams.page,
    pageSize: queryParams.pageSize,
    projectKey,
    search: queryParams.search,
    sort: sortQueryParams,
    filter: {
      services: selectedServiceNames,
      excepts: ["blocks-lmt-api"],
    },
  });
  const loading = isLoading || isFetching;
  const pageChangeHandler = (page: number) => {
    setQueryParams((params) => ({ ...params, page }));
  };
  const pageSizeChangeHandler = (pageSize: number) => {
    setQueryParams((params) => ({ ...params, page: 0, pageSize }));
  };
  const tabChangedHandler = (value: keyof typeof TRACE_PROVIDERS) => {
    setQueryParams((params) => ({ ...params, tab: value, page: 0 }));
  };
  const hasActiveFilter = queryParams.search.trim().length > 0 || queryParams.services.length > 0;
  return (
    <main>
      <Tabs
        value={tabId}
        onValueChange={(value: string) => tabChangedHandler(value as keyof typeof TRACE_PROVIDERS)}
      >
        <PageHeader
          title="Tracing"
          description="Trace requests across services"
          actions={
            <>
              <Button onClick={() => setOpen((current) => !current)} variant="outline" size="sm">
                <BookOpenText className="aspect-square w-4" />
                <span className="sr-only sm:not-sr-only sm:ml-2">Guide</span>
              </Button>
              <LMTQueryAgentSheet
                description="Hello! I can help you search and analyze your logs, metrics, and tracing data."
                questions={[
                  "Show me traces for the last 1 hour",
                  "Which services are generating the most traces",
                  "Which traces had high latency today",
                ]}
              />
            </>
          }
        />
        <div className="mb-4 sm:mb-5">
          {isMobile ? (
            <Select
              value={tabId}
              onValueChange={(value: string) =>
                tabChangedHandler(value as keyof typeof TRACE_PROVIDERS)
              }
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRACE_MODE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {TRACE_MODE_OPTIONS.map((option) => {
                const Icon = option.Icon;
                const isActive = tabId === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => tabChangedHandler(option.value as keyof typeof TRACE_PROVIDERS)}
                    className={[
                      "rounded-xl border p-4 text-left transition-all",
                      isActive
                        ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                        : "border-border bg-background hover:border-primary/40 hover:bg-accent/30",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={[
                          "rounded-lg p-2",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground",
                        ].join(" ")}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium text-high-emphasis">{option.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {option.description}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <TabsContent value="hot">
          <Card>
            <CardHeader>
              <TracesFilterToolbar
                queryParams={queryParams}
                setQueryParams={setQueryParams}
                serviceOptions={serviceOptions}
              />
            </CardHeader>
            <CardContent>
              <TracesList
                data={data?.data || []}
                isLoading={loading}
                serviceLabels={serviceLabels}
                hasActiveFilter={hasActiveFilter}
              />
              {!loading && data && data.totalCount > queryParams.pageSize && (
                <div className="mt-5 flex items-center md:justify-end">
                  <Pagination
                    page={queryParams.page}
                    pageSize={queryParams.pageSize}
                    pageSizeOptions={[10, 20, 50]}
                    onChange={pageChangeHandler}
                    onPageSizeChange={pageSizeChangeHandler}
                    totalCount={data.totalCount || 0}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="cold">
          <RestoredTracesTab
            sourceType={TRACE_REQUEST_SOURCE_TYPE.cold}
            projectKey={projectKey}
            queryParams={queryParams}
            setQueryParams={setQueryParams}
            sortQueryParams={sortQueryParams}
            serviceOptions={serviceOptions}
            serviceLabels={serviceLabels}
            selectedServiceNames={selectedServiceNames}
            hasActiveFilter={hasActiveFilter}
          />
        </TabsContent>
        <TabsContent value="archive">
          <RestoredTracesTab
            sourceType={TRACE_REQUEST_SOURCE_TYPE.archive}
            projectKey={projectKey}
            queryParams={queryParams}
            setQueryParams={setQueryParams}
            sortQueryParams={sortQueryParams}
            serviceOptions={serviceOptions}
            serviceLabels={serviceLabels}
            selectedServiceNames={selectedServiceNames}
            hasActiveFilter={hasActiveFilter}
          />
        </TabsContent>
        {!isMobile ? (
          <TraceProviderSetupGuideLine open={open} onOpenChange={setOpen} provider={provider} />
        ) : null}
      </Tabs>
    </main>
  );
}
