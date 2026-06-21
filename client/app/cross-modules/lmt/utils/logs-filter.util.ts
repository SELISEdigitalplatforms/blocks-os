import type { SortValue } from "@/components/filter-toolbar/sort-header/sort-header"
import type { LogServiceRow } from "@blocks-lmt/models/log-entry.model"
import Fuse, { type IFuseOptions } from "fuse.js"

export const LOG_SEARCH_MIN_LENGTH = 3

const FUSE_OPTIONS: IFuseOptions<LogServiceRow> = {
  keys: [
    { name: "name", weight: 0.5 },
    { name: "description", weight: 0.5 },
  ],
  threshold: 0.4,
}

const sortGetters: Record<string, (row: LogServiceRow) => string> = {
  Name: (row) => row.name,
  Description: (row) => row.description,
}

const sortLogServices = (
  rows: LogServiceRow[],
  sort: SortValue,
): LogServiceRow[] => {
  const getter = sortGetters[sort.property]
  if (!getter) return rows

  return [...rows].sort((left, right) => {
    const leftValue = getter(left)
    const rightValue = getter(right)
    const comparison =
      leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0
    return sort.isDescending ? -comparison : comparison
  })
}

export type LogFilterInput = {
  rows: LogServiceRow[]
  search: string
  sort: SortValue
}

export const filterLogServices = ({
  rows,
  search,
  sort,
}: LogFilterInput): LogServiceRow[] => {
  let filtered = rows

  const trimmedSearch = search.trim()
  if (trimmedSearch.length >= LOG_SEARCH_MIN_LENGTH) {
    const fuse = new Fuse(filtered, FUSE_OPTIONS)
    filtered = fuse.search(trimmedSearch).map((result) => result.item)
  }

  return sortLogServices(filtered, sort)
}
