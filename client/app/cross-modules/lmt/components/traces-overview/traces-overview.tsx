import { PageHeader } from "@/components/page-header/page-header";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent, CardHeader } from "@/components/ui-kits/card/card";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { Tabs, TabsContent } from "@/components/ui-kits/tabs/tabs";
import { LMTQueryAgentSheet } from "@blocks-ai/components/lmt-query-agent/lmt-query-agent-sheet";
import { useIsMobile } from "@seliseblocks/genesis-os/hooks";
import { TraceProviderSetupGuideLine } from "@blocks-lmt/components/trace-guideline/trace-provider-guideline";
import { TRACE_PROVIDERS, TRACE_REQUEST_SOURCE_TYPE } from "@blocks-lmt/constants/trace.constant";
import { useGetBlocksServices, useGetTraces } from "@blocks-lmt/hooks/use-trace";
import { useQuery } from "@tanstack/react-query";
import { BookOpenText } from "lucide-react";
import { useMemo, useState } from "react";
import { serviceRegistryService } from "@/cross-modules/identifier/services/service-registry.service";
import { StorageTierCards } from "../storage-tier-cards/storage-tier-cards";
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
 * Traces are only ever written by API collections -- workers don't emit them -- so the
 * service filter is a flat list: one option per blocks service, valued by its API
 * collection name, followed by the registered services. A blocks service without an API
 * collection has nothing to trace and is left out.
 */
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
      .filter((service) => !!service.apiServiceName)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((service) => ({ label: service.label, value: service.apiServiceName }));
    const registered = (registeredServices?.data ?? []).map((service) => ({
      label: service.name,
      value: service.serviceId,
    }));
    const merged: ServiceOption[] = [...blocksServices, ...registered];
    return merged.filter(
      (item, index, array) => array.findIndex((value) => value.value === item.value) === index,
    );
  }, [blocksServicesData, registeredServices?.data]);
  const serviceLabels = useMemo(() => {
    const labels = new Map<string, string>();
    for (const service of registeredServices?.data ?? []) {
      labels.set(service.serviceId, service.name);
    }
    // Blocks services are written last so they win a name collision, as before.
    for (const service of blocksServicesData ?? []) {
      if (service.apiServiceName) labels.set(service.apiServiceName, service.label);
    }
    return labels;
  }, [blocksServicesData, registeredServices?.data]);
  // Nothing checked means no service filter at all. Values that aren't a current option
  // (e.g. a stale link) are dropped rather than sent as a filter that matches nothing.
  const selectedServiceNames = useMemo(
    () =>
      queryParams.services.filter((value) =>
        serviceOptions.some((option) => option.value === value),
      ),
    [queryParams.services, serviceOptions],
  );
  const { data, isLoading, isFetching } = useGetTraces({
    page: queryParams.page,
    pageSize: queryParams.pageSize,
    search: queryParams.search,
    sort: sortQueryParams,
    filter: {
      services: selectedServiceNames,
      excepts: ["blocks-lmt-api"],
      statusCodeClasses: queryParams.status.map(Number),
      // Each end is sent only when it was chosen: an omitted one leaves that side unbounded
      // rather than pinning it to a timestamp the reader never asked for.
      startDate: queryParams.startDate || undefined,
      endDate: queryParams.endDate || undefined,
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
  const hasActiveFilter =
    queryParams.search.trim().length > 0 ||
    queryParams.services.length > 0 ||
    queryParams.status.length > 0 ||
    queryParams.startDate.length > 0 ||
    queryParams.endDate.length > 0;
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
          <StorageTierCards
            value={tabId}
            onChange={(tier) => tabChangedHandler(tier as keyof typeof TRACE_PROVIDERS)}
            descriptions={{
              [TRACE_PROVIDERS.hot]: "Live and recent traces for active debugging.",
              [TRACE_PROVIDERS.cold]: "Longer-term stored traces for later investigation.",
              [TRACE_PROVIDERS.archive]: "Deep history retained for audit and export use cases.",
            }}
          />
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
