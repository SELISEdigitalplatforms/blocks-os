import { FilterToolbar } from "@/components/filter-toolbar";
import { useContext } from "react";
import { LogsViewerContext } from "../logs-viewer";
import { LOG_LEVEL } from "../../utils";
export const LogsFilterToolbar = () => {
  const {
    services,
    selectedService,
    changeService,
    filter,
    setFilter,
    resetFilter,
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
  const onChange = (key: string, value: unknown) => {
    if (key === "service") return handleServiceChange(value as string);
    if (key === "date") return updateDate(value as { from?: Date; to?: Date });
    return updateFilter(key as keyof typeof filter, value);
  };
  return (
    <FilterToolbar
      filters={[
        { key: "search", type: "SearchInput", label: "label" },
        {
          key: "date",
          type: "DateRange",
          label: "Date",
          props: {},
        },
        {
          key: "service",
          type: "Radio",
          label: "Service",
          props: { options: serviceOptions },
        },
        {
          key: "level",
          type: "Radio",
          label: "Type",
          props: { options: levels },
        },
      ]}
      values={{
        search,
        level,
        service: selectedService?.id || "",
        date: {
          from: startDate ? new Date(startDate) : "",
          to: endDate ? new Date(endDate) : "",
        },
      }}
      defaultValues={{
        search: "",
        level: "",
        service: "",
        date: { from: "", to: "" },
      }}
      onChange={onChange}
      onReset={resetFilter}
    />
  );
};
