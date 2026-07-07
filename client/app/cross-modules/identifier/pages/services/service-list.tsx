import { ServiceCard } from "@blocks-identifier/components/service-card/service-card";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { EmptyState } from "@/components/ui-kits/empty-state";
import { useGetAllServices } from "@blocks-identifier/hooks/use-services";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { parseAsInteger, useQueryStates } from "nuqs";
import { Accordion, AccordionItem } from "@/components/ui-kits/accordion/accordion";
import { Layers } from "lucide-react";
const ServiceListSkeleton = () => (
  <div className="grid gap-4">
    {Array.from({ length: 3 }).map((_, index) => (
      <Card key={index}>
        <CardContent>
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="mt-2 h-12" />
          <Skeleton className="mt-2 h-12" />
        </CardContent>
      </Card>
    ))}
  </div>
);
const EmptyServiceList = () => (
  <EmptyState
    icon={Layers}
    title="No services yet"
    description="Register your first service to get started."
  />
);
export const ServiceList = () => {
  const [queryParams, setQueryParams] = useQueryStates({
    page: parseAsInteger.withDefault(0),
    pageSize: parseAsInteger.withDefault(10),
  });
  const { data, isLoading, isFetching } = useGetAllServices({
    page: queryParams.page,
    pageSize: queryParams.pageSize,
  });
  const onPageChangeHandler = (page: number) => {
    setQueryParams((params) => ({ ...params, page }));
  };
  const isServiceLoading = isLoading || isFetching;
  if (isServiceLoading) return <ServiceListSkeleton />;
  if (!data?.totalCount) return <EmptyServiceList />;
  return (
    <>
      <Accordion type="single" collapsible className="grid grid-cols-1 gap-y-4">
        {data?.data.map((service) => (
          <AccordionItem
            value={service.itemId}
            key={service.itemId}
            className="rounded-sm border bg-background"
          >
            <ServiceCard
              key={service.itemId}
              service={{
                ...service,
                metadata: service.metadata ?? {},
              }}
            />
          </AccordionItem>
        ))}
      </Accordion>
      {!isServiceLoading && data && data.totalCount > queryParams.pageSize && (
        <div className="flex items-center md:justify-end">
          <Pagination
            page={queryParams.page}
            pageSize={queryParams.pageSize}
            totalCount={data?.totalCount || 0}
            onChange={onPageChangeHandler}
          />
        </div>
      )}
    </>
  );
};
