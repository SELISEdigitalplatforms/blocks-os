import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@seliseblocks/blocks-kit/hooks", () => ({
  usePopoverWidth: () => [{ current: null }, 200],
  useIsMobile: () => false,
}));

import { DataTableFacetedFilter } from "./data-table-faceted-filter";

type ColumnLike = {
  getFacetedUniqueValues: () => Map<string, number>;
  getFilterValue: () => { types?: string[] } | undefined;
  setFilterValue: ReturnType<typeof vi.fn>;
};

const makeColumn = (
  types: string[] | undefined,
  facets: Map<string, number> = new Map(),
): ColumnLike => ({
  getFacetedUniqueValues: () => facets,
  getFilterValue: () => (types ? { types } : undefined),
  setFilterValue: vi.fn(),
});

const options = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Pending", value: "pending" },
];

describe("DataTableFacetedFilter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the title with no badges when nothing is selected", () => {
    const column = makeColumn(undefined);
    render(<DataTableFacetedFilter column={column as never} title="Status" options={options} />);
    expect(screen.getAllByText("Status").length).toBeGreaterThan(0);
    expect(screen.queryByText("Active")).toBeNull();
  });

  it("renders selected option badges when one or two are selected", () => {
    const column = makeColumn(["active", "inactive"]);
    render(<DataTableFacetedFilter column={column as never} title="Status" options={options} />);
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("Inactive")).toBeTruthy();
  });

  it("collapses to a count badge when more than two are selected", () => {
    const column = makeColumn(["active", "inactive", "pending"]);
    render(<DataTableFacetedFilter column={column as never} title="Status" options={options} />);
    expect(screen.getByText("3 selected")).toBeTruthy();
  });

  it("adds a filter value when an option is selected from the popover", async () => {
    const user = userEvent.setup();
    const column = makeColumn(undefined, new Map([["active", 5]]));
    render(<DataTableFacetedFilter column={column as never} title="Status" options={options} />);
    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByText("Active"));
    expect(column.setFilterValue).toHaveBeenCalledWith({ types: ["active"] });
  });

  it("clears the filter via the clear action", async () => {
    const user = userEvent.setup();
    const column = makeColumn(["active"]);
    render(<DataTableFacetedFilter column={column as never} title="Status" options={options} />);
    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByText("Clear"));
    expect(column.setFilterValue).toHaveBeenCalledWith(undefined);
  });
});
