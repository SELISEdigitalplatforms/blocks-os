"use client"

import { FilterChangeHandler, FilterToolbar } from "@/components/filter-toolbar"
import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryStates } from "nuqs"

export const usePeopleFilterQueryParams = () => {
  const [queryParams, setQueryParams] = useQueryStates({
    page: parseAsInteger.withDefault(0),
    pageSize: parseAsInteger.withDefault(100),
    search: parseAsString.withDefault(""),
    environments: parseAsArrayOf(parseAsString).withDefault([]),
    status: parseAsArrayOf(parseAsString).withDefault([]),
  })
  return { queryParams, setQueryParams }
}

export const PeopleFilterToolbar = () => {
  const { queryParams, setQueryParams } = usePeopleFilterQueryParams()

  type PeopleFilter = {
    search: string
    environments: string[]
    status: string[]
  }

  const onChange: FilterChangeHandler<PeopleFilter> = (_key, _value, values) => {
    setQueryParams((prev) => ({
      ...prev,
      ...values,
      page: 0,
    }))
  }

  const onReset = () => {
    setQueryParams(null)
  }

  return (
    <FilterToolbar<PeopleFilter>
      hideGlobalResetButton={true}
      filters={[{ key: "search", type: "SearchInput", label: "label" }]}
      values={{
        search: queryParams.search,
        environments: queryParams.environments,
        status: queryParams.status,
      }}
      defaultValues={{ search: "", environments: [], status: [] }}
      onChange={onChange}
      onReset={onReset}
    />
  )
}
