import { FilterToolbar, useSortQueryParams } from "@/components/filter-toolbar";
import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { useMemo } from "react";

export type TraceFilter = { search: string; services: string[] };

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
}: {
  queryParams: TraceFilter;
  setQueryParams: ReturnType<typeof useTracesFilterQueryParams>["setQueryParams"];
  serviceOptions: ServiceOption[];
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

  return (
    <FilterToolbar<TraceFilter>
      filters={[
        { key: "search", type: "SearchInput", label: "" },
        {
          key: "services",
          type: "CheckboxTree",
          label: "Service",
          props: { options: serviceOptions },
        },
      ]}
      values={{
        search: queryParams.search,
        services: displayedServices,
      }}
      defaultValues={{ search: "", services: defaultServiceSelection(serviceOptions) }}
      onChange={(key, value) => changeHandler(String(key), value)}
      onReset={resetHandler}
    />
  );
}
