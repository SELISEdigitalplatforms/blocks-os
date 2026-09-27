import { FilterItem, FilterToolbar } from "@/components/filter-toolbar";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { MailStatus } from "@blocks-communication/mail/models/email";
type EmailUsageFilter = {
  search: string;
  sendDate: { from?: Date | string; to?: Date | string };
  status: string;
  configurationId: string;
};
export const useEmailUsageFilterQueryParams = () => {
  const [queryParams, setQueryParams] = useQueryStates({
    search: parseAsString.withDefault(""),
    startDate: parseAsString.withDefault(""),
    endDate: parseAsString.withDefault(""),
    status: parseAsString.withDefault(""),
    // Not "mailConfigurationId": the Templates tab's filter owns that URL param.
    configurationId: parseAsString.withDefault(""),
    page: parseAsInteger.withDefault(0),
    pageSize: parseAsInteger.withDefault(10),
  });
  return { queryParams, setQueryParams };
};
export function EmailUsageFilterToolbar({
  isInbound,
  configurations = [],
}: {
  isInbound: boolean;
  /** The inbound configurations a received mail can be filtered by. */
  configurations?: Array<{ itemId: string; name: string }>;
}) {
  const { queryParams, setQueryParams } = useEmailUsageFilterQueryParams();
  const updateSendDate = (value: { from?: Date; to?: Date } | null) => {
    const { from, to } = value || {};
    setQueryParams((params) => ({
      ...params,
      startDate: from ? from.toISOString() : "",
      endDate: to ? to.toISOString() : "",
      page: 0,
    }));
  };
  const changeHandler = (key: string, value: unknown) => {
    if (key === "sendDate") return updateSendDate(value as { from?: Date; to?: Date });
    setQueryParams((params) => ({
      ...params,
      [key]: value,
      page: 0,
    }));
  };
  const resetHandler = () => setQueryParams(null);
  const statusOptions = Object.values(MailStatus).map((status) => ({
    label: status,
    value: status,
  }));
  const filters: FilterItem<EmailUsageFilter>[] = [{ key: "search", type: "SearchInput", label: "" }];
  if (isInbound) {
    // Inbound only: outbound rows are not stamped with the configuration that sent them.
    filters.push({
      key: "configurationId",
      type: "Radio",
      label: "Configuration",
      props: {
        options: configurations.map((config) => ({ label: config.name, value: config.itemId })),
      },
    });
  } else {
    filters.push({
      key: "status",
      type: "Radio",
      label: "Status",
      props: {
        options: statusOptions,
      },
    });
  }
  filters.push({
    key: "sendDate",
    type: "DateRange",
    label: isInbound ? "Received Date" : "Send Date",
    props: {},
  });
  return (
    <FilterToolbar<EmailUsageFilter>
      filters={filters}
      values={{
        search: queryParams.search,
        sendDate: {
          from: queryParams.startDate ? new Date(queryParams.startDate) : "",
          to: queryParams.endDate ? new Date(queryParams.endDate) : "",
        },
        status: queryParams.status,
        configurationId: queryParams.configurationId,
      }}
      defaultValues={{ search: "", sendDate: { from: "", to: "" }, status: "", configurationId: "" }}
      onChange={changeHandler}
      onReset={resetHandler}
    />
  );
}
