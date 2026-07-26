import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  setQueryParams: vi.fn(),
  queryParams: { searchField: "name", search: "", page: 0, pageSize: 10, environments: [], status: [] },
}));

vi.mock("nuqs", () => {
  const parser = { withDefault: (d: unknown) => ({ defaultValue: d }) };
  return {
    parseAsInteger: parser,
    parseAsString: parser,
    parseAsArrayOf: () => parser,
    useQueryStates: () => [h.queryParams, h.setQueryParams],
  };
});

vi.mock("@/components/filter-toolbar", () => ({
  FilterToolbar: (props: Record<string, unknown>) => {
    const filters = props.filters as Array<{ key: string; type: string }>;
    return (
      <div data-testid="filter-toolbar">
        <span data-testid="filter-keys">{filters.map((f) => `${f.key}:${f.type}`).join(",")}</span>
        <button
          data-testid="change-search"
          onClick={() =>
            (props.onChange as (k: string, v: unknown) => void)("search", {
              selected: "email",
              value: "term",
            })
          }
        >
          change
        </button>
        <button
          data-testid="change-other"
          onClick={() => (props.onChange as (k: string, v: unknown) => void)("other", "x")}
        >
          other
        </button>
        <button data-testid="reset" onClick={() => (props.onReset as () => void)()}>
          reset
        </button>
      </div>
    );
  },
}));

import { PeopleFilterToolbar } from "./people-filter-toolbar";

describe("PeopleFilterToolbar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a dropdown search input filter", () => {
    render(<PeopleFilterToolbar />);
    expect(screen.getByTestId("filter-keys").textContent).toContain("search:DropdownSearchInput");
  });

  it("maps a search change to the searchField and search params and resets the page", () => {
    render(<PeopleFilterToolbar />);
    fireEvent.click(screen.getByTestId("change-search"));
    const updater = h.setQueryParams.mock.calls[0][0] as (p: object) => object;
    expect(updater({ searchField: "name", search: "" })).toMatchObject({
      searchField: "email",
      search: "term",
      page: 0,
    });
  });

  it("ignores changes for keys other than search", () => {
    render(<PeopleFilterToolbar />);
    fireEvent.click(screen.getByTestId("change-other"));
    expect(h.setQueryParams).not.toHaveBeenCalled();
  });

  it("clears all params on reset", () => {
    render(<PeopleFilterToolbar />);
    fireEvent.click(screen.getByTestId("reset"));
    expect(h.setQueryParams).toHaveBeenCalledWith(null);
  });
});
