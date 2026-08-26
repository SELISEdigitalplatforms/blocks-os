import { FilterToolbar, useSortQueryParams } from "@/components/filter-toolbar";
import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryStates } from "nuqs";

export type TraceFilter = { search: string; services: string[] };

export type ServiceOption = {
  label: string;
  value: string;
  children?: { label: string; value: string }[];
};

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
        services: queryParams.services,
      }}
      defaultValues={{ search: "", services: [] }}
      onChange={(key, value) => changeHandler(String(key), value)}
      onReset={resetHandler}
    />
  );
}
