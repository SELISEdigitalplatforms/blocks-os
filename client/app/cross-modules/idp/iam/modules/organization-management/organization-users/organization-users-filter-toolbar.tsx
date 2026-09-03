import { FilterToolbar, useSortQueryParams } from "@/components/filter-toolbar";
import { useGetRoleFilterOptions } from "@blocks-idp/iam/hooks/use-roles";
import { Mail, User } from "lucide-react";
import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { useProjectStore } from "@seliseblocks/genesis-os";

type OrganizationUsersFilter = {
  search: { selected: string; value: string };
  roles: string[];
};

export const useOrganizationUsersFilterQueryParams = () => {
  const [queryParams, setQueryParams] = useQueryStates({
    page: parseAsInteger.withDefault(0),
    pageSize: parseAsInteger.withDefault(5),
    "selected-filter": parseAsString.withDefault("name"),
    name: parseAsString.withDefault(""),
    email: parseAsString.withDefault(""),
    roles: parseAsArrayOf(parseAsString).withDefault([]),
  });
  return { queryParams, setQueryParams };
};

export const useOrganizationUsersSortQueryParams = () =>
  useSortQueryParams({
    initial: { property: "FirstName", isDescending: false },
  });

export const OrganizationUsersFilterToolbar = ({ organizationId }: { organizationId: string }) => {
  const { queryParams, setQueryParams } = useOrganizationUsersFilterQueryParams();
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const selectedRoles = queryParams.roles ?? [];
  const { data: roleOptions = [], isLoading: isRolesLoading } = useGetRoleFilterOptions(
    { projectKey: tenantId, organizationIds: [organizationId] },
    { enabled: !!tenantId && !!organizationId },
  );

  const changeHandler = (key: string, value: unknown) => {
    if (key === "search") {
      const val = value as { selected: "name" | "email"; value: string };
      return setQueryParams((params) => ({
        ...params,
        "selected-filter": val.selected,
        name: val.selected === "name" ? val.value : "",
        email: val.selected === "email" ? val.value : "",
        page: 0,
      }));
    }

    setQueryParams((params) => ({
      ...params,
      [key]: value,
      page: 0,
    }));
  };
  const resetHandler = () => {
    setQueryParams(null);
  };

  return (
    <FilterToolbar<OrganizationUsersFilter>
      filters={[
        {
          key: "search",
          type: "DropdownSearchInput",
          label: "",
          props: {
            placeholder: "Minimum 3 characters…",
            // The OS DropdownSearchInput exposes selectContent/SelectItem/input only,
            // so the iam-only selectTrigger and wrapper overrides are dropped here.
            className: {
              selectContent: "min-w-fit",
              SelectItem: "[&>*:first-child]:hidden flex justify-center px-2",
            },
            options: [
              { label: <Mail className="aspect-square w-4" />, value: "email" },
              { label: <User className="aspect-square w-4" />, value: "name" },
            ],
          },
        },
        {
          key: "roles",
          type: "MultiSelect",
          label: "Roles",
          props: {
            options: roleOptions,
            disabled: isRolesLoading,
          },
        },
      ]}
      values={{
        search: {
          selected: queryParams["selected-filter"],
          value: queryParams["selected-filter"] === "email" ? queryParams.email : queryParams.name,
        },
        roles: selectedRoles,
      }}
      defaultValues={{ search: { selected: "name", value: "" }, roles: [] }}
      onChange={changeHandler}
      onReset={resetHandler}
      hideGlobalResetButton
    />
  );
};
