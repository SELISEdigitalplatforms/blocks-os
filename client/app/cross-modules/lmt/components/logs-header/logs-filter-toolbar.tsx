import { FilterItem, FilterToolbar } from "@/components/filter-toolbar";
import { TimeRangeValue } from "@/components/filter-toolbar/time-range/time-range";
import { deepEqual } from "@/lib/utils";
import { useContext, useMemo } from "react";
import { DEFAULT_LOG_FILTER, LogsViewerContext } from "../logs-viewer";
import {
  LOG_LEVEL,
  getLogLevelLabel,
  getRangeStartDate,
  serviceKeyToTreeValues,
} from "../../utils";
import { restoreWindowBounds } from "../../utils/restore-window";

type LogsFilterValues = {
  search?: string;
  level?: string;
  service: string[];
  timeRange: TimeRangeValue;
};

export const LogsFilterToolbar = () => {
  const {
    services,
    serviceFilterValue,
    changeServices,
    filter,
    setFilter,
    resetFilter,
    restoreRequestId,
    restoreWindow,
  } = useContext(LogsViewerContext);
  // Reading a restore means reading a closed set of days: no relative default to fall back on,
  // no streaming to promise, and nothing outside the window worth offering.
  const isRestored = Boolean(restoreRequestId);
  const { level, startDate, endDate, search } = filter || {
    level: "",
    startDate: "",
    endDate: "",
    search: "",
  };
  const levels = Object.entries(LOG_LEVEL).map((item) => ({
    label: getLogLevelLabel(item[0]),
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
  // The relative default and an explicit window would otherwise both apply and fight over the
  // same period, so applying a window clears the default and resetting restores it. The
  // default stays relative because that is what lets the list keep tailing new logs.
  const updateTimeRange = (value: TimeRangeValue) => {
    if (!value) {
      setFilter((filter) => ({
        ...filter,
        // Over a restore there is no default to fall back to: its days are all older than any
        // relative window, so restoring one here would match nothing at all.
        range: isRestored ? "" : (DEFAULT_LOG_FILTER.range ?? ""),
        startDate: "",
        endDate: "",
      }));
      return;
    }
    setFilter((filter) => ({
      ...filter,
      range: "",
      startDate: value.from ? value.from.toISOString() : "",
      endDate: value.to ? value.to.toISOString() : "",
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
    if (key === "timeRange") return updateTimeRange(value as TimeRangeValue);
    return updateFilter(key as keyof typeof filter, value);
  };

  const defaultValues = useMemo<LogsFilterValues>(
    () => ({
      search: "",
      level: "",
      service: [],
      timeRange: null,
    }),
    [], // static — never changes
  );

  const currentValues = useMemo<LogsFilterValues>(
    () => ({
      search,
      level,
      service: serviceKeyToTreeValues(serviceFilterValue),
      // The relative default counts as "no window chosen", so the Reset chip stays hidden
      // until someone picks one -- and the picker shows the default rather than owning it.
      timeRange:
        startDate || endDate
          ? {
              from: startDate ? new Date(startDate) : undefined,
              to: endDate ? new Date(endDate) : undefined,
            }
          : null,
    }),
    [search, level, serviceFilterValue, startDate, endDate], // re-compute only when these change
  );

  // What the list is actually showing while no window is chosen: the last 30 minutes, left
  // open at the end. Pinned to the relative default rather than recomputed per render, so
  // the popover does not drift while it is open.
  const defaultRange = useMemo<TimeRangeValue>(() => {
    if (isRestored) return null;
    const start = getRangeStartDate(DEFAULT_LOG_FILTER.range ?? "");
    return start ? { from: new Date(start) } : null;
  }, [isRestored]);

  const bounds = useMemo(
    () =>
      isRestored
        ? restoreWindowBounds(restoreWindow?.startDate, restoreWindow?.endDate)
        : undefined,
    [isRestored, restoreWindow?.startDate, restoreWindow?.endDate],
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
    const timeRangeChanged = !deepEqual(currentValues.timeRange, defaultValues.timeRange);
    const serviceChanged =
      currentValues.service.length !== defaultServiceSelection.length ||
      currentValues.service.some((value, index) => value !== defaultServiceSelection[index]);
    return !searchChanged && !levelChanged && !timeRangeChanged && !serviceChanged;
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
      key: "timeRange",
      type: "TimeRange",
      label: "Time range",
      // Log rows are rendered in UTC, so the window has to be written in UTC to match them.
      props: {
        defaultRange,
        timeZone: "utc",
        openEndHint: isRestored ? "the end of the window" : "now — keeps streaming",
        bounds,
      },
    },
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
