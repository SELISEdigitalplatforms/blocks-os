import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Table } from "@tanstack/react-table";

const h = vi.hoisted(() => ({
  isMobile: false,
  serviceBarOpen: false,
  activeFilters: 0,
}));

vi.mock("@seliseblocks/genesis-os/hooks", () => ({ useIsMobile: () => h.isMobile }));
vi.mock("@/hooks/use-active-filters-count", () => ({
  useActiveFiltersCount: () => h.activeFilters,
}));
vi.mock("@blocks-communication/mail/hooks/use-is-service-tab-open-comm", () => ({
  default: () => h.serviceBarOpen,
}));

import { EmailTableToolbar } from "./email-table-toolbar";

const makeTable = () => {
  const setFilterValue = vi.fn();
  const resetColumnFilters = vi.fn();
  const table = {
    getColumn: () => ({ setFilterValue }),
    resetColumnFilters,
  } as unknown as Table<unknown>;
  return { table, setFilterValue, resetColumnFilters };
};

describe("EmailTableToolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isMobile = false;
    h.serviceBarOpen = false;
    h.activeFilters = 0;
  });

  it("filters the name column as the user types", async () => {
    const user = userEvent.setup();
    const { table, setFilterValue } = makeTable();
    render(<EmailTableToolbar table={table} />);
    const input = screen.getAllByPlaceholderText("Filter communication")[0];
    await user.type(input, "hello");
    await waitFor(() => expect(setFilterValue).toHaveBeenCalledWith("hello"));
  });

  it("shows a reset button when filters are active and resets on click", async () => {
    h.activeFilters = 2;
    const user = userEvent.setup();
    const { table, resetColumnFilters } = makeTable();
    render(<EmailTableToolbar table={table} />);
    await user.click(screen.getByRole("button", { name: /Reset/ }));
    expect(resetColumnFilters).toHaveBeenCalled();
  });

  it("renders the filter sheet trigger with a count badge when the service bar is open", () => {
    h.serviceBarOpen = true;
    h.activeFilters = 3;
    const { table } = makeTable();
    render(<EmailTableToolbar table={table} />);
    expect(screen.getByText("3")).toBeTruthy();
  });
});
