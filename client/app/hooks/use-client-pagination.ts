import { useState } from "react";

const DEFAULT_PAGE_SIZE = 10;

/**
 * Pages a list that is already fully loaded. The page is clamped to the last valid page on
 * every render, so deleting the last row of the last page (or a shorter filtered list) never
 * leaves an empty page. Call `reset` when a search or filter changes to go back to page 1.
 */
export function useClientPagination<T>(items: readonly T[], initialPageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const lastPage = Math.max(0, Math.ceil(items.length / pageSize) - 1);
  const currentPage = Math.min(Math.max(0, page), lastPage);
  const pageItems = items.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const changePageSize = (size: number) => {
    setPageSize(size);
    setPage(0);
  };
  const reset = () => setPage(0);

  return {
    page: currentPage,
    pageSize,
    pageItems,
    totalCount: items.length,
    setPage,
    setPageSize: changePageSize,
    reset,
  };
}
