import { FilterToolbar } from "@/components/filter-toolbar";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { notificationImportances } from "../constants/notification.constant";

type NotificationConfigFilter = {
  search: string;
  importance: string;
  service: string;
};

export const useNotificationConfigsFilterQueryParams = () => {
  const [queryParams, setQueryParams] = useQueryStates({
    notificationSearch: parseAsString.withDefault(""),
    notificationImportance: parseAsString.withDefault(""),
    notificationService: parseAsString.withDefault(""),
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
      notificationPage: 0,
    }));

  return (
    <FilterToolbar<NotificationConfigFilter>
      filters={[
        { key: "search", type: "SearchInput", label: "" },
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
        ...(serviceOptions.length > 0
          ? [
              {
                key: "service" as const,
                type: "Radio" as const,
                label: "Service",
                props: {
                  options: serviceOptions.map((service) => ({ label: service, value: service })),
                },
              },
            ]
          : []),
      ]}
      values={{
        search: queryParams.notificationSearch,
        importance: queryParams.notificationImportance,
        service: queryParams.notificationService,
      }}
      defaultValues={{ search: "", importance: "", service: "" }}
      onChange={changeHandler}
      onReset={resetHandler}
    />
  );
}
