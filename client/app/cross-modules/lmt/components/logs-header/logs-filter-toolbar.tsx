import { FilterItem, FilterToolbar } from "@/components/filter-toolbar";
import { useContext, useMemo } from "react";
import { LogsViewerContext } from "../logs-viewer";
import { LOG_LEVEL } from "../../utils";

const SUB_SERVICE_OPTIONS = [
  { label: "All", value: "all" },
  { label: "API", value: "api" },
  { label: "Worker", value: "worker" },
];

type LogsFilterValues = {
  search?: string;
  level?: string;
  service: string;
  subService: string;
  date: { from?: Date; to?: Date } | null;
};

export const LogsFilterToolbar = () => {
  const {
    services,
    selectedService,
    changeService,
    filter,
    setFilter,
    resetFilter,
    isSourceBlocks,
    subService,
    setSubService,
  } = useContext(LogsViewerContext);
  const { level, startDate, endDate, search } = filter || {
    level: "",
    startDate: "",
    endDate: "",
    search: "",
  };
  const levels = Object.entries(LOG_LEVEL).map((item) => ({
    label: item[0],
    value: item[1],
  }));
  const serviceOptions = services.map((s) => ({ label: s.label, value: s.id }));
  const updateFilter = (key: keyof typeof filter, value: unknown) => {
    setFilter((filter) => ({
      ...filter,
      [key]: value,
    }));
  };
  const updateDate = (value: { from?: Date; to?: Date } | null) => {
    const { from, to } = value || {};
    setFilter((filter) => ({
      ...filter,
      startDate: from ? from.toISOString() : "",
      endDate: to ? to.toISOString() : "",
    }));
  };
  const handleServiceChange = (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    if (service) {
      changeService(service);
    }
  };
  const handleSubServiceChange = (value: string) => {
    setSubService(value);
  };
  const onChange = (
    key: keyof LogsFilterValues,
    value: LogsFilterValues[keyof LogsFilterValues],
  ) => {
    if (key === "service") return handleServiceChange(value as string);
    if (key === "subService") return handleSubServiceChange(value as string);
    if (key === "date")
      return updateDate(value as { from?: Date; to?: Date } | null);
    return updateFilter(key as keyof typeof filter, value);
  };

  const defaultValues = useMemo<LogsFilterValues>(
    () => ({
      search: "",
      level: "",
      service: "",
      subService: "all",
      date: null,
    }),
    [], // static — never changes
  );

  const currentValues = useMemo<LogsFilterValues>(
    () => ({
      search,
      level,
      service: selectedService?.id || "",
      subService,
      date:
        startDate || endDate
          ? {
              from: startDate ? new Date(startDate) : undefined,
              to: endDate ? new Date(endDate) : undefined,
            }
          : null,
    }),
    [search, level, selectedService?.id, subService, startDate, endDate], // re-compute only when these change
  );

  // Check if only service or subService are changed from defaults
  const isOnlyServiceChanged = useMemo(() => {
    const searchChanged = currentValues.search !== defaultValues.search;
    const levelChanged = currentValues.level !== defaultValues.level;
    const dateChanged =
      (currentValues.date?.from?.getTime() ?? 0) !==
        (defaultValues.date?.from?.getTime() ?? 0) ||
      (currentValues.date?.to?.getTime() ?? 0) !==
        (defaultValues.date?.to?.getTime() ?? 0);
    return !searchChanged && !levelChanged && !dateChanged;
  }, [currentValues, defaultValues]);

  // ✅ Use FilterItem<LogsFilterValues> directly — it's already the right discriminated union
  const filters: FilterItem<LogsFilterValues>[] = [
    { key: "search", type: "SearchInput", label: "label" },
    { key: "date", type: "DateRange", label: "Date", props: {} },
    {
      key: "service",
      type: "Radio",
      label: "Service",
      props: { options: serviceOptions },
    },
  ];

  if (isSourceBlocks) {
    filters.push({
      key: "subService",
      type: "Radio",
      label: "Sub-Service",
      props: { options: SUB_SERVICE_OPTIONS },
    });
  }

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
      onReset={() => {
        resetFilter();
        setSubService("all");
      }}
      hideGlobalResetButton={isOnlyServiceChanged}
    />
  );
};
