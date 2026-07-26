"use client";

import { FilterChangeHandler, FilterToolbar } from "@/components/filter-toolbar";
import { Mail, User } from "lucide-react";
import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryStates } from "nuqs";

export type PeopleSearchField = "name" | "email";

export const usePeopleFilterQueryParams = () => {
  const [queryParams, setQueryParams] = useQueryStates({
    page: parseAsInteger.withDefault(0),
    pageSize: parseAsInteger.withDefault(10),
    search: parseAsString.withDefault(""),
    searchField: parseAsString.withDefault("name"),
    environments: parseAsArrayOf(parseAsString).withDefault([]),
    status: parseAsArrayOf(parseAsString).withDefault([]),
  });
  return { queryParams, setQueryParams };
};

export const PeopleFilterToolbar = () => {
  const { queryParams, setQueryParams } = usePeopleFilterQueryParams();

  type PeopleFilter = {
    search: { selected: PeopleSearchField; value: string };
  };

  const onChange: FilterChangeHandler<PeopleFilter> = (key, value) => {
    if (key === "search") {
      const val = value as { selected: PeopleSearchField; value: string };
      setQueryParams((prev) => ({
        ...prev,
        searchField: val.selected,
        search: val.value,
        page: 0,
      }));
      return;
    }
  };

  const onReset = () => {
    setQueryParams(null);
  };

  return (
    <FilterToolbar<PeopleFilter>
      hideGlobalResetButton={true}
      filters={[
        {
          key: "search",
          type: "DropdownSearchInput",
          label: "",
          props: {
            placeholder: "Minimum 3 characters…",
            debounceMs: 2000,
            minSearchLength: 3,
            keepValueOnTypeChange: true,
            options: [
              {
                label: (
                  <span className="flex items-center gap-2">
                    <User className="aspect-square w-4" /> Name
                  </span>
                ),
                value: "name",
              },
              {
                label: (
                  <span className="flex items-center gap-2">
                    <Mail className="aspect-square w-4" /> Email
                  </span>
                ),
                value: "email",
              },
            ],
          },
        },
      ]}
      values={{
        search: {
          selected: (queryParams.searchField as PeopleSearchField) ?? "name",
          value: queryParams.search,
        },
      }}
      defaultValues={{ search: { selected: "name", value: "" } }}
      onChange={onChange}
      onReset={onReset}
    />
  );
};
