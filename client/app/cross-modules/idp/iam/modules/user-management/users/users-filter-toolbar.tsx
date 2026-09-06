import { FilterToolbar, useSortQueryParams } from "@/components/filter-toolbar";
import {
  useGetAllEnabledOrganizations,
  useGetOrganizationConfig,
} from "@blocks-idp/iam/hooks/use-organization";
import { useGetRoleFilterOptions } from "@blocks-idp/iam/hooks/use-roles";
import { Mail, User } from "lucide-react";
import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useMemo } from "react";

const DEFAULT_ORGANIZATION_ID = "default";

type DateRange = { from?: Date | string; to?: Date | string };

type SearchFilter = {
  search: { selected: "name" | "email"; value: string };
};

type DateFilters = {
  organizationIds: string[];
  roles: string[];
  joinedOn: DateRange;
  lastLogin: DateRange;
  lastUpdatedDate: DateRange;
};

export const useUsersFilterQueryParams = () => {
  const [queryParams, setQueryParams] = useQueryStates({
    page: parseAsInteger.withDefault(0),
    pageSize: parseAsInteger.withDefault(10),
    "selected-filter": parseAsString.withDefault("name"),
    name: parseAsString.withDefault(""),
    email: parseAsString.withDefault(""),
    organizationIds: parseAsArrayOf(parseAsString).withDefault([]),
    roles: parseAsArrayOf(parseAsString).withDefault([]),
    "joinedOn-start": parseAsString.withDefault(""),
    "joinedOn-end": parseAsString.withDefault(""),
    "lastLogin-start": parseAsString.withDefault(""),
    "lastLogin-end": parseAsString.withDefault(""),
    "lastUpdatedDate-start": parseAsString.withDefault(""),
    "lastUpdatedDate-end": parseAsString.withDefault(""),
  });
  return { queryParams, setQueryParams };
};

export const useUsersSortQueryParams = () =>
  useSortQueryParams({
    initial: { property: "FirstName", isDescending: false },
  });

const rangeToIso = (value: DateRange | null | undefined) => {
  if (!value) return { from: undefined, to: undefined };
  const toIso = (v: Date | string | undefined) =>
    v ? (typeof v === "string" ? v : v.toISOString()) : undefined;
  return { from: toIso(value.from), to: toIso(value.to) };
};

const isoToRange = (fromStr: string, toStr: string): DateRange => ({
  from: fromStr ? new Date(fromStr) : undefined,
  to: toStr ? new Date(toStr) : undefined,
});

export const UsersSearchFilter = () => {
  const { queryParams, setQueryParams } = useUsersFilterQueryParams();

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
    <FilterToolbar<SearchFilter>
      filters={[
        {
          key: "search",
          type: "DropdownSearchInput",
          label: "",
          props: {
            placeholder: "Minimum 3 characters…",
            className: {
              selectContent: "min-w-fit",
              SelectItem: "[&>*:first-child]:hidden flex justify-center px-2",
              input: "w-full sm:w-52",
            },
            options: [
              { label: <Mail className="aspect-square w-4" />, value: "email" },
              { label: <User className="aspect-square w-4" />, value: "name" },
            ],
          },
        },
      ]}
      values={{
        search: {
          selected: queryParams["selected-filter"] as "name" | "email",
          value: queryParams["selected-filter"] === "email" ? queryParams.email : queryParams.name,
        },
      }}
      defaultValues={{ search: { selected: "name", value: "" } }}
      onChange={changeHandler}
      onReset={resetHandler}
      hideGlobalResetButton
    />
  );
};

export const UsersDateFilters = () => {
  const { queryParams, setQueryParams } = useUsersFilterQueryParams();
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { data: orgConfig } = useGetOrganizationConfig(tenantId);
  const showOrganizationFilter = orgConfig?.isMultiOrgEnabled === true;
  const selectedOrganizationIds = useMemo(
    () => queryParams.organizationIds ?? [],
    [queryParams.organizationIds],
  );
  const selectedRoles = queryParams.roles ?? [];
  const { data: organizations = [], isLoading: isOrganizationsLoading } =
    useGetAllEnabledOrganizations(tenantId, {
      enabled: showOrganizationFilter || orgConfig?.isMultiOrgEnabled === false,
    });

  const organizationOptions = useMemo(
    () =>
      organizations.map((organization) => ({
        label: organization.name,
        value: organization.itemId,
      })),
    [organizations],
  );
  const hasOrganizationOptions = organizationOptions.length > 0;
  const showOrganizationSelection = showOrganizationFilter && hasOrganizationOptions;
  const showRoleSelection = hasOrganizationOptions;
  const isRoleSelectionWaitingForOrganizations =
    showOrganizationSelection && selectedOrganizationIds.length === 0;

  const roleOrganizationIds = useMemo(() => {
    if (!hasOrganizationOptions) return [];
    if (showOrganizationFilter && selectedOrganizationIds.length === 0) return [];
    if (!showOrganizationFilter) return [DEFAULT_ORGANIZATION_ID];
    return selectedOrganizationIds;
  }, [hasOrganizationOptions, selectedOrganizationIds, showOrganizationFilter]);

  const { data: roleOptions = [], isLoading: isRolesLoading } = useGetRoleFilterOptions(
    { projectKey: tenantId, organizationIds: roleOrganizationIds },
    { enabled: !!tenantId && roleOrganizationIds.length > 0 },
  );

  const setRangeQueryParams = (
    key: "joinedOn" | "lastLogin" | "lastUpdatedDate",
    value: DateRange | null,
  ) => {
    const { from, to } = rangeToIso(value);
    setQueryParams((params) => ({
      ...params,
      [`${key}-start`]: from ?? "",
      [`${key}-end`]: to ?? "",
      page: 0,
    }));
  };

  const changeHandler = (key: string, value: unknown) => {
    if (key === "organizationIds") {
      return setQueryParams((params) => ({
        ...params,
        organizationIds: value as string[],
        roles: [],
        page: 0,
      }));
    }

    if (key === "joinedOn" || key === "lastLogin" || key === "lastUpdatedDate") {
      return setRangeQueryParams(key, value as { from?: Date; to?: Date } | null);
    }

    setQueryParams((params) => ({
      ...params,
      [key]: value,
      page: 0,
    }));
  };
  const resetHandler = () => {
    setQueryParams((params) => ({
      ...params,
      organizationIds: [],
      roles: [],
      "joinedOn-start": "",
      "joinedOn-end": "",
      "lastLogin-start": "",
      "lastLogin-end": "",
      "lastUpdatedDate-start": "",
      "lastUpdatedDate-end": "",
      page: 0,
    }));
  };

  return (
    <FilterToolbar<DateFilters>
      filters={[
        ...(showOrganizationSelection
          ? [
              {
                key: "organizationIds" as const,
                type: "MultiSelect" as const,
                label: "Organizations",
                props: {
                  options: organizationOptions,
                  disabled: isOrganizationsLoading,
                },
              },
            ]
          : []),
        ...(showRoleSelection
          ? [
              {
                key: "roles" as const,
                type: "MultiSelect" as const,
                label: "Roles",
                props: {
                  options: roleOptions,
                  disabled: isRoleSelectionWaitingForOrganizations || isRolesLoading,
                },
              },
            ]
          : []),
        {
          key: "joinedOn",
          type: "DateRange",
          label: "Created On",
          props: { numberOfMonths: 1 },
        },
        {
          key: "lastLogin",
          type: "DateRange",
          label: "Last login",
          props: { numberOfMonths: 1 },
        },
        {
          key: "lastUpdatedDate",
          type: "DateRange",
          label: "Last updated",
          props: { numberOfMonths: 1 },
        },
      ]}
      values={{
        organizationIds: showOrganizationSelection ? selectedOrganizationIds : [],
        roles: showRoleSelection && !isRoleSelectionWaitingForOrganizations ? selectedRoles : [],
        joinedOn: isoToRange(queryParams["joinedOn-start"], queryParams["joinedOn-end"]),
        lastLogin: isoToRange(queryParams["lastLogin-start"], queryParams["lastLogin-end"]),
        lastUpdatedDate: isoToRange(
          queryParams["lastUpdatedDate-start"],
          queryParams["lastUpdatedDate-end"],
        ),
      }}
      defaultValues={{
        organizationIds: [],
        roles: [],
        joinedOn: { from: undefined, to: undefined },
        lastLogin: { from: undefined, to: undefined },
        lastUpdatedDate: { from: undefined, to: undefined },
      }}
      onChange={changeHandler}
      onReset={resetHandler}
      displayMode="sheet"
      sheetTriggerLabel="Filters"
    />
  );
};

export { rangeToIso, isoToRange };
export type { DateRange };
