import { FilterToolbar } from "@/components/filter-toolbar";
import { Label } from "@/components/ui-kits/label/label";
import { Switch } from "@/components/ui-kits/switch/switch";
import { parseAsBoolean, parseAsInteger, parseAsString, useQueryStates } from "nuqs";

type ConfigurationsFilter = {
  search: string;
};

export const useSignupLinkConfigurationsQueryParams = () => {
  const [queryParams, setQueryParams] = useQueryStates({
    page: parseAsInteger.withDefault(0),
    pageSize: parseAsInteger.withDefault(10),
    search: parseAsString.withDefault(""),
    includeInactive: parseAsBoolean.withDefault(false),
  });
  return { queryParams, setQueryParams };
};

export const ConfigurationsFilterToolbar = () => {
  const { queryParams, setQueryParams } = useSignupLinkConfigurationsQueryParams();

  const changeHandler = (key: string, value: string) => {
    setQueryParams((params) => ({ ...params, [key]: value, page: 0 }));
  };

  const resetHandler = () => {
    setQueryParams(null);
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <FilterToolbar<ConfigurationsFilter>
        filters={[{ key: "search", type: "SearchInput", label: "Search" }]}
        values={{ search: queryParams.search }}
        defaultValues={{ search: "" }}
        onChange={changeHandler}
        onReset={resetHandler}
      />
      <div className="flex items-center gap-2">
        <Switch
          id="show-archived-configurations"
          checked={queryParams.includeInactive}
          onCheckedChange={(checked) =>
            setQueryParams((params) => ({
              ...params,
              includeInactive: checked,
              page: 0,
            }))
          }
        />
        <Label htmlFor="show-archived-configurations" className="text-sm font-normal">
          Show archived
        </Label>
      </div>
    </div>
  );
};
