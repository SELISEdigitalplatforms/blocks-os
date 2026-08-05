import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  setQueryParams: vi.fn(),
  queryParams: { search: "role", page: 0, pageSize: 10 },
  sort: vi.fn(),
  useGetOrganizations: vi.fn(),
}));

vi.mock("nuqs", () => {
  const parser = { withDefault: (d: unknown) => ({ defaultValue: d }) };
  return {
    parseAsInteger: parser,
    parseAsString: parser,
    useQueryStates: () => [h.queryParams, h.setQueryParams],
  };
});

vi.mock("../../../hooks/use-organization", () => ({
  useGetOrganizations: () => h.useGetOrganizations(),
}));

vi.mock("@seliseblocks/genesis-os/store", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));

vi.mock("@/components/filter-toolbar", () => ({
  useSortQueryParams: (arg: unknown) => {
    h.sort(arg);
    return [{ property: "Name", isDescending: false }, vi.fn()];
  },
  FilterToolbar: (props: Record<string, unknown>) => (
    <div data-testid="filter-toolbar">
      <button
        data-testid="change"
        onClick={() => (props.onChange as (k: string, v: string) => void)("search", "abc")}
      >
        change
      </button>
      <button data-testid="reset" onClick={() => (props.onReset as () => void)()}>
        reset
      </button>
    </div>
  ),
}));

import {
  RolesFilterToolBar,
  useRolesSortQueryParams,
} from "./roles-filter-toolbar";

describe("RolesFilterToolBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.useGetOrganizations.mockReturnValue({ data: { organizations: [] } });
  });

  it("updates a filter value and resets the page", () => {
    render(<RolesFilterToolBar />);
    fireEvent.click(screen.getByTestId("change"));
    const updater = h.setQueryParams.mock.calls[0][0] as (p: object) => object;
    expect(updater({ search: "" })).toMatchObject({ search: "abc", page: 0 });
  });

  it("clears all params on reset", () => {
    render(<RolesFilterToolBar />);
    fireEvent.click(screen.getByTestId("reset"));
    expect(h.setQueryParams).toHaveBeenCalledWith(null);
  });

  it("initializes sort with Name ascending", () => {
    useRolesSortQueryParams();
    expect(h.sort).toHaveBeenCalledWith({ initial: { property: "Name", isDescending: false } });
  });
});
