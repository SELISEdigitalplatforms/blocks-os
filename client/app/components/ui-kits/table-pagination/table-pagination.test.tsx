import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Table } from "@tanstack/react-table";
import { TablePagination } from "./table-pagination";

type Fns = {
  setPageIndex: ReturnType<typeof vi.fn>;
  previousPage: ReturnType<typeof vi.fn>;
  nextPage: ReturnType<typeof vi.fn>;
  setPageSize: ReturnType<typeof vi.fn>;
};

const makeTable = (
  overrides: {
    rows?: number;
    selected?: number;
    pageIndex?: number;
    pageCount?: number;
    canPrev?: boolean;
    canNext?: boolean;
  } = {},
): { table: Table<unknown>; fns: Fns } => {
  const {
    rows = 25,
    selected = 2,
    pageIndex = 0,
    pageCount = 3,
    canPrev = true,
    canNext = true,
  } = overrides;
  const fns: Fns = {
    setPageIndex: vi.fn(),
    previousPage: vi.fn(),
    nextPage: vi.fn(),
    setPageSize: vi.fn(),
  };
  const table = {
    getFilteredRowModel: () => ({ rows: new Array(rows).fill({}) }),
    getFilteredSelectedRowModel: () => ({ rows: new Array(selected).fill({}) }),
    getState: () => ({ pagination: { pageSize: 10, pageIndex } }),
    getPageCount: () => pageCount,
    getCanPreviousPage: () => canPrev,
    getCanNextPage: () => canNext,
    ...fns,
  } as unknown as Table<unknown>;
  return { table, fns };
};

describe("TablePagination", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the selected-row summary when there is no totalCount", () => {
    const { table } = makeTable({ rows: 25, selected: 2 });
    render(<TablePagination table={table} />);
    expect(screen.getByText(/2 of/)).toBeTruthy();
    expect(screen.getByText(/Page 1 of 3/)).toBeTruthy();
  });

  it("shows the pluralized total item count when totalCount is provided", () => {
    const { table } = makeTable();
    render(<TablePagination table={table} totalCount={5} />);
    expect(screen.getByText(/Total 5 items/)).toBeTruthy();
  });

  it("shows the singular label for a single item", () => {
    const { table } = makeTable();
    render(<TablePagination table={table} totalCount={1} />);
    expect(screen.getByText(/Total 1 item/)).toBeTruthy();
  });

  it("jumps to the first page and reports it", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const { table, fns } = makeTable();
    render(<TablePagination table={table} onPageChange={onPageChange} />);
    const buttons = screen.getAllByRole("button");
    await user.click(buttons[0]);
    expect(fns.setPageIndex).toHaveBeenCalledWith(0);
    expect(onPageChange).toHaveBeenCalledWith(0);
  });

  it("moves to the previous and next pages", async () => {
    const user = userEvent.setup();
    const { table, fns } = makeTable({ pageIndex: 1 });
    render(<TablePagination table={table} />);
    const buttons = screen.getAllByRole("button");
    await user.click(buttons[1]);
    expect(fns.previousPage).toHaveBeenCalled();
    await user.click(buttons[2]);
    expect(fns.nextPage).toHaveBeenCalled();
  });

  it("jumps to the last page", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const { table, fns } = makeTable({ pageCount: 4 });
    render(<TablePagination table={table} onPageChange={onPageChange} />);
    const buttons = screen.getAllByRole("button");
    await user.click(buttons[buttons.length - 1]);
    expect(fns.setPageIndex).toHaveBeenCalledWith(3);
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("disables navigation when paging is not possible", () => {
    const { table } = makeTable({ canPrev: false, canNext: false });
    render(<TablePagination table={table} />);
    screen
      .getAllByRole("button")
      .forEach((btn) => expect((btn as HTMLButtonElement).disabled).toBe(true));
  });
});
