import { FilterToolbar } from "@/components/filter-toolbar";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { notificationImportances } from "../constants/notification.constant";
import {
  NOTIFICATION_SCOPE,
  NOTIFICATION_TEXT,
  RECEIVER_OPTIONS,
} from "../constants/notification-ui.constant";

type NotificationConfigFilter = {
  search: string;
  importance: string;
  service: string;
  sendTo: string;
  receivers: string;
};

/** "Send to" offers one side; a notification sent to both sides matches either. */
const SEND_TO_FILTER_OPTIONS = [
  { label: NOTIFICATION_TEXT.projectUsers, value: String(NOTIFICATION_SCOPE.Project) },
  { label: NOTIFICATION_TEXT.consoleUsers, value: String(NOTIFICATION_SCOPE.Console) },
];

export const useNotificationConfigsFilterQueryParams = () => {
  const [queryParams, setQueryParams] = useQueryStates({
    notificationSearch: parseAsString.withDefault(""),
    notificationImportance: parseAsString.withDefault(""),
    notificationService: parseAsString.withDefault(""),
    notificationSendTo: parseAsString.withDefault(""),
    notificationReceivers: parseAsString.withDefault(""),
    notificationPage: parseAsInteger.withDefault(0),
    notificationPageSize: parseAsInteger.withDefault(10),
  });
  return { queryParams, setQueryParams };
};

interface NotificationConfigsFilterToolBarProps {
  /** Distinct source services of the loaded rows; the service filter hides when there are none. */
  serviceOptions?: string[];
}

export function NotificationConfigsFilterToolBar({
  serviceOptions = [],
}: Readonly<NotificationConfigsFilterToolBarProps>) {
  const { queryParams, setQueryParams } = useNotificationConfigsFilterQueryParams();

  const changeHandler = (key: string, value: unknown) => {
    if (key === "search") {
      setQueryParams((params) => ({
        ...params,
        notificationSearch: value as string,
        notificationPage: 0,
      }));
    } else if (key === "importance") {
      setQueryParams((params) => ({
        ...params,
        notificationImportance: (value as string) ?? "",
        notificationPage: 0,
      }));
    } else if (key === "sendTo") {
      setQueryParams((params) => ({
        ...params,
        notificationSendTo: (value as string) ?? "",
        notificationPage: 0,
      }));
    } else if (key === "receivers") {
      setQueryParams((params) => ({
        ...params,
        notificationReceivers: (value as string) ?? "",
        notificationPage: 0,
      }));
    } else if (key === "service") {
      setQueryParams((params) => ({
        ...params,
        notificationService: (value as string) ?? "",
        notificationPage: 0,
      }));
    }
  };

  const resetHandler = () =>
    setQueryParams((params) => ({
      ...params,
      notificationSearch: "",
      notificationImportance: "",
      notificationService: "",
      notificationSendTo: "",
      notificationReceivers: "",
      notificationPage: 0,
    }));

  return (
    <FilterToolbar<NotificationConfigFilter>
      filters={[
        { key: "search", type: "SearchInput", label: "", props: { placeholder: "Search by name" } },
        {
          key: "importance",
          type: "Radio",
          label: "Importance",
          props: {
            options: notificationImportances
              .filter((item) => item.value > 0)
              .map((item) => ({ label: item.label, value: String(item.value) })),
          },
        },
        {
          key: "sendTo",
          type: "Radio",
          label: NOTIFICATION_TEXT.filters.sendTo,
          props: { options: SEND_TO_FILTER_OPTIONS },
        },
        {
          key: "receivers",
          type: "Radio",
          label: NOTIFICATION_TEXT.filters.receivers,
          props: {
            options: RECEIVER_OPTIONS.map((o) => ({ label: o.label, value: String(o.value) })),
          },
        },
        ...(serviceOptions.length > 0
          ? [
              {
                key: "service" as const,
                type: "Radio" as const,
                label: "Service",
                props: {
                  options: serviceOptions.map((service) => ({
                    label: service.replace(/^blocks-/, ""),
                    value: service,
                  })),
                },
              },
            ]
          : []),
      ]}
      values={{
        search: queryParams.notificationSearch,
        importance: queryParams.notificationImportance,
        service: queryParams.notificationService,
        sendTo: queryParams.notificationSendTo,
        receivers: queryParams.notificationReceivers,
      }}
      defaultValues={{ search: "", importance: "", service: "", sendTo: "", receivers: "" }}
      onChange={changeHandler}
      onReset={resetHandler}
    />
  );
}
