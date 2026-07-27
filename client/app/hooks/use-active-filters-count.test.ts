import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useActiveFiltersCount } from "./use-active-filters-count";
import type { Table } from "@tanstack/react-table";
import type { DateRange } from "react-day-picker";

const makeTable = (columnFilters: Array<{ id: string; value: unknown }>) =>
  ({
    getState: () => ({ columnFilters }),
  }) as unknown as Table<unknown>;

describe("useActiveFiltersCount", () => {
  it("returns 0 with no filters and no date range", () => {
    const { result } = renderHook(() => useActiveFiltersCount(makeTable([]), undefined, "search"));
    expect(result.current).toBe(0);
  });

  it("counts the length of a search column's types array", () => {
    const table = makeTable([{ id: "search", value: { types: ["a", "b"] } }]);
    const { result } = renderHook(() => useActiveFiltersCount(table, undefined, "search"));
    expect(result.current).toBe(2);
  });

  it("counts array filter values by length", () => {
    const table = makeTable([{ id: "status", value: ["open", "closed"] }]);
    const { result } = renderHook(() => useActiveFiltersCount(table, undefined, "search"));
    expect(result.current).toBe(2);
  });

  it("counts object filter values by key count", () => {
    const table = makeTable([{ id: "meta", value: { a: 1, b: 2, c: 3 } }]);
    const { result } = renderHook(() => useActiveFiltersCount(table, undefined, "search"));
    expect(result.current).toBe(3);
  });

  it("counts a scalar non-empty filter value as one", () => {
    const table = makeTable([{ id: "name", value: "abc" }]);
    const { result } = renderHook(() => useActiveFiltersCount(table, undefined, "search"));
    expect(result.current).toBe(1);
  });

  it("ignores empty-string scalar values", () => {
    const table = makeTable([{ id: "name", value: "" }]);
    const { result } = renderHook(() => useActiveFiltersCount(table, undefined, "search"));
    expect(result.current).toBe(0);
  });

  it("adds one when a date range is active", () => {
    const dateRange = { from: new Date() } as DateRange;
    const { result } = renderHook(() => useActiveFiltersCount(makeTable([]), dateRange, "search"));
    expect(result.current).toBe(1);
  });
});
