import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useClientPagination } from "./use-client-pagination";

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("useClientPagination", () => {
  it("slices the list to the page size", () => {
    const { result } = renderHook(() => useClientPagination(range(25)));
    expect(result.current.pageItems).toEqual(range(10));
    expect(result.current.totalCount).toBe(25);
  });

  it("moves to another page", () => {
    const { result } = renderHook(() => useClientPagination(range(25)));
    act(() => result.current.setPage(2));
    expect(result.current.pageItems).toEqual([21, 22, 23, 24, 25]);
  });

  it("goes back to page 1 on reset and on page size change", () => {
    const { result } = renderHook(() => useClientPagination(range(60)));
    act(() => result.current.setPage(3));
    act(() => result.current.reset());
    expect(result.current.page).toBe(0);
    act(() => result.current.setPage(3));
    act(() => result.current.setPageSize(25));
    expect(result.current.page).toBe(0);
    expect(result.current.pageItems).toHaveLength(25);
  });

  it("falls back to the last valid page when the list shrinks", () => {
    const { result, rerender } = renderHook(({ items }) => useClientPagination(items), {
      initialProps: { items: range(21) },
    });
    act(() => result.current.setPage(2));
    expect(result.current.pageItems).toEqual([21]);
    rerender({ items: range(20) });
    expect(result.current.page).toBe(1);
    expect(result.current.pageItems).toEqual(range(20).slice(10));
  });

  it("stays on page 1 for an empty list", () => {
    const { result } = renderHook(() => useClientPagination<number>([]));
    expect(result.current.page).toBe(0);
    expect(result.current.pageItems).toEqual([]);
  });
});
