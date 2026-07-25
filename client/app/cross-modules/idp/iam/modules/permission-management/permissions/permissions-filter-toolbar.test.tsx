import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  setQueryParams: vi.fn(),
  queryParams: {
    search: "",
    isBuiltIn: "",
    type: "",
    page: 0,
    pageSize: 10,
    permissionSeverity: "",
  },
  sort: vi.fn(),
  keys: [] as string[],
}));

vi.mock("nuqs", () => {
  const parser = { withDefault: (d: unknown) => ({ defaultValue: d }) };
  return {
    parseAsInteger: parser,
    parseAsString: parser,
    useQueryStates: () => [h.queryParams, h.setQueryParams],
  };
});

vi.mock("@/components/filter-toolbar", () => ({
  useSortQueryParams: (arg: unknown) => {
    h.sort(arg);
    return [{ property: "Name", isDescending: false }, vi.fn()];
  },
  FilterToolbar: (props: Record<string, unknown>) => {
    h.keys = (props.filters as Array<{ key: string }>).map((f) => f.key);
    return (
      <div>
        <button
          data-testid="change"
          onClick={() => (props.onChange as (k: string, v: unknown) => void)("isBuiltIn", "yes")}
        >
          change
        </button>
        <button data-testid="reset" onClick={() => (props.onReset as () => void)()}>
          reset
        </button>
      </div>
    );
  },
}));

import {
  PermissionsFilterToolbar,
  usePermissionsSortQuaryParams,
} from "./permissions-filter-toolbar";

describe("PermissionsFilterToolbar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("declares search, source, severity and type filters", () => {
    render(<PermissionsFilterToolbar />);
    expect(h.keys).toEqual(["search", "isBuiltIn", "permissionSeverity", "type"]);
  });

  it("updates a filter value and resets the page", () => {
    render(<PermissionsFilterToolbar />);
    fireEvent.click(screen.getByTestId("change"));
    const updater = h.setQueryParams.mock.calls[0][0] as (p: object) => object;
    expect(updater({ isBuiltIn: "" })).toMatchObject({ isBuiltIn: "yes", page: 0 });
  });

  it("clears all params on reset", () => {
    render(<PermissionsFilterToolbar />);
    fireEvent.click(screen.getByTestId("reset"));
    expect(h.setQueryParams).toHaveBeenCalledWith(null);
  });

  it("initializes sort with Name ascending", () => {
    usePermissionsSortQuaryParams();
    expect(h.sort).toHaveBeenCalledWith({ initial: { property: "Name", isDescending: false } });
  });
});
