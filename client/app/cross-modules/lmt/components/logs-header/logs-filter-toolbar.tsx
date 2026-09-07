import { FilterItem, FilterToolbar } from "@/components/filter-toolbar";
import { useContext, useMemo } from "react";
import { DEFAULT_LOG_FILTER, LogsViewerContext } from "../logs-viewer";
import { LMT_TIME_RANGES, LOG_LEVEL, serviceKeyToTreeValues } from "../../utils";

type LogsFilterValues = {
  search?: string;
  level?: string;
  service: string[];
  date: { from?: Date; to?: Date } | null;
  range: string;
};

export const LogsFilterToolbar = () => {
  const { services, serviceFilterValue, changeServices, filter, setFilter, resetFilter } =
    useContext(LogsViewerContext);
  const { level, startDate, endDate, search, range } = filter || {
    level: "",
    startDate: "",
    endDate: "",
    search: "",
    range: "",
  };
  const levels = Object.entries(LOG_LEVEL).map((item) => ({
    label: item[0],
    value: item[1],
  }));
  const serviceOptions = services.map((s) => ({
    label: s.label,
    value: s.id,
    children: s.components?.map((c) => ({ label: c.label, value: `${s.id}::${c.value}` })),
  }));
  const updateFilter = (key: keyof typeof filter, value: unknown) => {
    setFilter((filter) => ({
      ...filter,
      [key]: value,
    }));
  };
  // An absolute range and a relative preset would otherwise both apply and fight over the
  // same window, so choosing either one clears the other.
  const updateDate = (value: { from?: Date; to?: Date } | null) => {
    const { from, to } = value || {};
    setFilter((filter) => ({
      ...filter,
      startDate: from ? from.toISOString() : "",
      endDate: to ? to.toISOString() : "",
      range: "",
    }));
  };
  const updateRange = (value: string | null) => {
    setFilter((filter) => ({
      ...filter,
      range: value ?? "",
      ...(value ? { startDate: "", endDate: "" } : {}),
    }));
  };
  const handleServiceChange = (serviceKeys: string[] | null) => {
    // Values for services that are no longer registered are dropped rather than
    // written back into the URL.
    const knownKeys = (serviceKeys ?? []).filter((key) =>
      services.some((service) => service.id === key.split("::")[0]),
    );
    changeServices(knownKeys);
  };
  const onChange = (
    key: keyof LogsFilterValues,
    value: LogsFilterValues[keyof LogsFilterValues],
  ) => {
    if (key === "service") return handleServiceChange(value as string[] | null);
    if (key === "date") return updateDate(value as { from?: Date; to?: Date } | null);
    if (key === "range") return updateRange(value as string | null);
    return updateFilter(key as keyof typeof filter, value);
  };

  const defaultValues = useMemo<LogsFilterValues>(
    () => ({
      search: "",
      level: "",
      service: [],
      date: null,
      range: DEFAULT_LOG_FILTER.range ?? "",
    }),
    [], // static — never changes
  );

  const currentValues = useMemo<LogsFilterValues>(
    () => ({
      search,
      level,
      service: serviceKeyToTreeValues(serviceFilterValue),
      date:
        startDate || endDate
          ? {
              from: startDate ? new Date(startDate) : undefined,
              to: endDate ? new Date(endDate) : undefined,
            }
          : null,
      range: range ?? "",
    }),
    [search, level, serviceFilterValue, startDate, endDate, range], // re-compute only when these change
  );

  // The whole first service is what the page starts on, so that selection counts as
  // "no service filter applied" for the Reset button.
  const defaultServiceSelection = useMemo(
    () => (services.length > 0 ? [services[0].id] : []),
    [services],
  );

  // The Reset button is offered as soon as anything — the service selection included —
  // differs from what the page opens with.
  const isPristine = useMemo(() => {
    const searchChanged = currentValues.search !== defaultValues.search;
    const levelChanged = currentValues.level !== defaultValues.level;
    const dateChanged =
      (currentValues.date?.from?.getTime() ?? 0) !== (defaultValues.date?.from?.getTime() ?? 0) ||
      (currentValues.date?.to?.getTime() ?? 0) !== (defaultValues.date?.to?.getTime() ?? 0);
    const rangeChanged = currentValues.range !== defaultValues.range;
    const serviceChanged =
      currentValues.service.length !== defaultServiceSelection.length ||
      currentValues.service.some((value, index) => value !== defaultServiceSelection[index]);
    return !searchChanged && !levelChanged && !dateChanged && !rangeChanged && !serviceChanged;
  }, [currentValues, defaultValues, defaultServiceSelection]);

  const handleReset = () => {
    resetFilter();
    // An empty selection puts the service filter back on the whole first service.
    changeServices([]);
  };

  // ✅ Use FilterItem<LogsFilterValues> directly — it's already the right discriminated union
  const filters: FilterItem<LogsFilterValues>[] = [
    { key: "search", type: "SearchInput", label: "label" },
    {
      key: "range",
      type: "Radio",
      label: "Time",
      props: { options: LMT_TIME_RANGES.map(({ label, value }) => ({ label, value })) },
    },
    { key: "date", type: "DateRange", label: "Date", props: {} },
    {
      key: "service",
      type: "CheckboxTree",
      label: "Service",
      props: { options: serviceOptions },
    },
  ];

  filters.push({
    key: "level",
    type: "Radio",
    label: "Type",
    props: { options: levels },
  });
  return (
    <FilterToolbar<LogsFilterValues>
      filters={filters}
      values={currentValues}
      defaultValues={defaultValues}
      onChange={onChange}
      onReset={handleReset}
      hideGlobalResetButton={isPristine}
    />
  );
};
