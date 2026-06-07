import { FilterToolbar } from "@/components/filter-toolbar";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";

type NotificationConfigFilter = {
  search: string;
};

export const useNotificationConfigsFilterQueryParams = () => {
  const [queryParams, setQueryParams] = useQueryStates({
    notificationSearch: parseAsString.withDefault(""),
    notificationPage: parseAsInteger.withDefault(0),
    notificationPageSize: parseAsInteger.withDefault(10),
  });
  return { queryParams, setQueryParams };
};

export function NotificationConfigsFilterToolBar() {
  const { queryParams, setQueryParams } = useNotificationConfigsFilterQueryParams();

  const changeHandler = (key: string, value: unknown) => {
    if (key === "search") {
      setQueryParams((params) => ({
        ...params,
        notificationSearch: value as string,
        notificationPage: 0,
      }));
    }
  };

  const resetHandler = () =>
    setQueryParams((params) => ({
      ...params,
      notificationSearch: "",
      notificationPage: 0,
    }));

  return (
    <FilterToolbar<NotificationConfigFilter>
      filters={[{ key: "search", type: "SearchInput", label: "" }]}
      values={{ search: queryParams.notificationSearch }}
      defaultValues={{ search: "" }}
      onChange={changeHandler}
      onReset={resetHandler}
    />
  );
}
