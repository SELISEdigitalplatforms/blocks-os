import { FilterItem, FilterToolbar, useSortQueryParams } from "@/components/filter-toolbar";
import { TRACE_STATUS_CLASSES, LMT_TIME_RANGES } from "@blocks-lmt/utils";
import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { useMemo } from "react";

export type TraceFilter = {
  search: string;
  services: string[];
  status: string[];
  range: string;
};

export type ServiceOption = {
  label: string;
  value: string;
  children?: { label: string; value: string }[];
};

/**
 * The first root option is treated as the implicit default selection so the
 * filter is never in an "empty -> fetch everything" state on first paint.
 * The URL stays empty until the user interacts, so resetting back to the
 * default behaviour remains a no-op write.
 */
export const defaultServiceSelection = (serviceOptions: ServiceOption[]): string[] =>
  serviceOptions[0] ? [serviceOptions[0].value] : [];

export const useTracesFilterQueryParams = () => {
  const [queryParams, setQueryParams] = useQueryStates({
    tab: parseAsString.withDefault("hot"),
    search: parseAsString.withDefault(""),
    services: parseAsArrayOf(parseAsString).withDefault([]),
    // Leading digits of the HTTP status ("2", "5"), not whole codes -- see StatusCodeClasses.
    status: parseAsArrayOf(parseAsString).withDefault([]),
    // A preset key such as "15m". The window is resolved to a start date at query time so it
    // stays relative to now rather than to whenever the URL was written.
    range: parseAsString.withDefault(""),
    page: parseAsInteger.withDefault(0),
    pageSize: parseAsInteger.withDefault(10),
  });
  return { queryParams, setQueryParams };
};

export const useTraceSortQueryParams = () =>
  useSortQueryParams({
    initial: { property: "Timestamp", isDescending: true },
  });

export function TracesFilterToolbar({
  queryParams,
  setQueryParams,
  serviceOptions,
  showTimeRange = true,
}: {
  queryParams: TraceFilter;
  setQueryParams: ReturnType<typeof useTracesFilterQueryParams>["setQueryParams"];
  serviceOptions: ServiceOption[];
  /**
   * Cold and archived traces are older than every window this control offers, so the tab
   * showing them opts out rather than presenting a filter that can only return nothing.
   */
  showTimeRange?: boolean;
}) {
  const displayedServices = useMemo(
    () =>
      queryParams.services.length > 0
        ? queryParams.services
        : defaultServiceSelection(serviceOptions),
    [queryParams.services, serviceOptions],
  );
  const changeHandler = (key: string, value: unknown) => {
    setQueryParams((params) => ({
      ...params,
      [key]: Array.isArray(value) ? [...value] : value,
      page: 0,
    }));
  };
  const resetHandler = () => setQueryParams(null);

  const filters: FilterItem<TraceFilter>[] = [
    { key: "search", type: "SearchInput", label: "" },
    ...(showTimeRange
      ? ([
          {
            key: "range",
            type: "Radio",
            label: "Time",
            props: { options: LMT_TIME_RANGES.map(({ label, value }) => ({ label, value })) },
          },
        ] as FilterItem<TraceFilter>[])
      : []),
    {
      key: "status",
      type: "MultiSelect",
      label: "Status",
      props: { options: TRACE_STATUS_CLASSES.map(({ label, value }) => ({ label, value })) },
    },
    {
      key: "services",
      type: "CheckboxTree",
      label: "Service",
      props: { options: serviceOptions },
    },
  ];

  return (
    <FilterToolbar<TraceFilter>
      filters={filters}
      values={{
        search: queryParams.search,
        services: displayedServices,
        status: queryParams.status,
        range: queryParams.range,
      }}
      defaultValues={{
        search: "",
        services: defaultServiceSelection(serviceOptions),
        status: [],
        range: "",
      }}
      onChange={(key, value) => changeHandler(String(key), value)}
      onReset={resetHandler}
    />
  );
}
