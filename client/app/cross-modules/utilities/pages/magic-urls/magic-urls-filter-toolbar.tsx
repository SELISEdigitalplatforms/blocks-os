import { FilterToolbar } from "@/components/filter-toolbar";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";

type MagicUrlConfigFilter = {
  search: string;
};

export const useMagicUrlsFilterQueryParams = () => {
  const [queryParams, setQueryParams] = useQueryStates({
    search: parseAsString.withDefault(""),
    page: parseAsInteger.withDefault(0),
    pageSize: parseAsInteger.withDefault(10),
  });
  return { queryParams, setQueryParams };
};

export function MagicUrlsFilterToolBar() {
  const { queryParams, setQueryParams } = useMagicUrlsFilterQueryParams();

  const changeHandler = (key: string, value: unknown) => {
    setQueryParams((params) => ({
      ...params,
      [key]: value,
      page: 0,
    }));
  };

  const resetHandler = () => setQueryParams(null);

  return (
    <FilterToolbar<MagicUrlConfigFilter>
      filters={[{ key: "search", type: "SearchInput", label: "" }]}
      values={{ search: queryParams.search }}
      defaultValues={{ search: "" }}
      onChange={changeHandler}
      onReset={resetHandler}
    />
  );
}
