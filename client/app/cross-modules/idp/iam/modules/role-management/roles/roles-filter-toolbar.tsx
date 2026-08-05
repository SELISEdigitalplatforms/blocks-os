import { useMemo } from "react";
import { FilterToolbar, useSortQueryParams } from "@/components/filter-toolbar";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { useGetOrganizations } from "../../../hooks/use-organization";
import { useProjectStore } from "@seliseblocks/genesis-os/store";
type RolesFilter = {
  search: string;
  orgId: string;
};
export const useRolesFilterQueryParams = () => {
  const [queryParams, setQueryParams] = useQueryStates({
    page: parseAsInteger.withDefault(0),
    pageSize: parseAsInteger.withDefault(10),
    search: parseAsString.withDefault(""),
    orgId: parseAsString.withDefault("default"),
  });
  return { queryParams, setQueryParams };
};
export const useRolesSortQueryParams = () =>
  useSortQueryParams({
    initial: {
      property: "Name",
      isDescending: false,
    },
  });
export const RolesFilterToolBar = () => {
  const {
    queryParams: { search, orgId },
    setQueryParams,
  } = useRolesFilterQueryParams();
  const tenantId = useProjectStore().selectedProject?.tenantId || "";

  const { data } = useGetOrganizations({
    page: 0,
    pageSize: 100,
    projectKey: tenantId,
  });
  const orgOptions = useMemo(
    () =>
      data?.organizations.map((org) => ({
        label: org.name,
        value: org.itemId,
      })),
    [data?.organizations],
  );

  const changeHandler = (key: string, value: string) => {
    setQueryParams((params) => ({ ...params, [key]: value, page: 0 }));
  };
  const resetHandler = () => {
    setQueryParams(null);
  };
  return (
    <FilterToolbar<RolesFilter>
      filters={[
        { key: "search", type: "SearchInput", label: "Search" },
        {
          key: "orgId",
          type: "Radio",
          label: "Organization",
          props: {
            options: orgOptions || [],
          },
        },
      ]}
      values={{ search: search, orgId: orgId }}
      defaultValues={{ search: "", orgId: "default" }}
      onChange={changeHandler}
      onReset={resetHandler}
    />
  );
};
