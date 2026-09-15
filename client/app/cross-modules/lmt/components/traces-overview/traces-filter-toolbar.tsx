import { FilterItem, FilterToolbar, useSortQueryParams } from "@/components/filter-toolbar";
import type { TimeRangeValue } from "@/components/filter-toolbar/time-range/time-range";
import { TRACE_STATUS_CLASSES } from "@blocks-lmt/utils";
import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { useMemo } from "react";

/** The filter as it is held in the URL. */
export type TraceFilter = {
  search: string;
  services: string[];
  status: string[];
  startDate: string;
  endDate: string;
};

/** The filter as the controls bind to it: one window control over the two stored ends. */
type TraceFilterValues = {
  search: string;
  services: string[];
  status: string[];
  timeRange: TimeRangeValue;
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
    // The ends of the chosen window, as ISO instants. Empty means unbounded on that side,
    // so an empty pair is "every trace" -- which is what the list opens on.
    startDate: parseAsString.withDefault(""),
    endDate: parseAsString.withDefault(""),
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
  // Both ends live in the URL as their own params, so the one control writes them together.
  const changeTimeRange = (value: TimeRangeValue) => {
    setQueryParams((params) => ({
      ...params,
      startDate: value?.from ? value.from.toISOString() : "",
      endDate: value?.to ? value.to.toISOString() : "",
      page: 0,
    }));
  };
  const changeHandler = (key: string, value: unknown) => {
    if (key === "timeRange") return changeTimeRange(value as TimeRangeValue);
    setQueryParams((params) => ({
      ...params,
      [key]: Array.isArray(value) ? [...value] : value,
      page: 0,
    }));
  };
  const resetHandler = () => setQueryParams(null);

  const filters: FilterItem<TraceFilterValues>[] = [
    { key: "search", type: "SearchInput", label: "" },
    ...(showTimeRange
      ? ([
          {
            key: "timeRange",
            type: "TimeRange",
            label: "Time range",
            // Trace timestamps are listed in local time, not UTC, so the window is written
            // in local time too -- otherwise it would not line up with the column beside it.
            props: { timeZone: "local" },
          },
        ] as FilterItem<TraceFilterValues>[])
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
    <FilterToolbar<TraceFilterValues>
      filters={filters}
      values={{
        search: queryParams.search,
        services: displayedServices,
        status: queryParams.status,
        timeRange:
          queryParams.startDate || queryParams.endDate
            ? {
                from: queryParams.startDate ? new Date(queryParams.startDate) : undefined,
                to: queryParams.endDate ? new Date(queryParams.endDate) : undefined,
              }
            : null,
      }}
      defaultValues={{
        search: "",
        services: defaultServiceSelection(serviceOptions),
        status: [],
        timeRange: null,
      }}
      onChange={(key, value) => changeHandler(String(key), value)}
      onReset={resetHandler}
    />
  );
}
