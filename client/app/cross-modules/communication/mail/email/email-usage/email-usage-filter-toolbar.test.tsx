import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  setQueryParams: vi.fn(),
  queryParams: { search: "", startDate: "", endDate: "", status: "", page: 0, pageSize: 10 },
  toolbarProps: undefined as Record<string, unknown> | undefined,
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
  FilterToolbar: (props: Record<string, unknown>) => {
    h.toolbarProps = props;
    const filters = props.filters as Array<{ key: string }>;
    return (
      <div data-testid="filter-toolbar">
        <span data-testid="filter-keys">{filters.map((f) => f.key).join(",")}</span>
        <button
          data-testid="change-search"
          onClick={() => (props.onChange as (k: string, v: unknown) => void)("search", "hello")}
        >
          change search
        </button>
        <button
          data-testid="change-date"
          onClick={() =>
            (props.onChange as (k: string, v: unknown) => void)("sendDate", {
              from: new Date("2024-01-01T00:00:00Z"),
              to: new Date("2024-02-01T00:00:00Z"),
            })
          }
        >
          change date
        </button>
        <button data-testid="reset" onClick={() => (props.onReset as () => void)()}>
          reset
        </button>
      </div>
    );
  },
}));

import { EmailUsageFilterToolbar } from "./email-usage-filter-toolbar";

describe("EmailUsageFilterToolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.queryParams = { search: "", startDate: "", endDate: "", status: "", page: 0, pageSize: 10 };
  });

  it("includes the status filter for outbound usage", () => {
    render(<EmailUsageFilterToolbar isInbound={false} />);
    expect(screen.getByTestId("filter-keys").textContent).toContain("status");
    expect(screen.getByTestId("filter-keys").textContent).toContain("sendDate");
  });

  it("omits the status filter for inbound usage", () => {
    render(<EmailUsageFilterToolbar isInbound />);
    expect(screen.getByTestId("filter-keys").textContent).not.toContain("status");
  });

  it("updates a simple filter value and resets to the first page", () => {
    render(<EmailUsageFilterToolbar isInbound={false} />);
    fireEvent.click(screen.getByTestId("change-search"));
    const updater = h.setQueryParams.mock.calls[0][0] as (p: object) => object;
    expect(updater({ search: "" })).toMatchObject({ search: "hello", page: 0 });
  });

  it("maps a date range into ISO start and end dates", () => {
    render(<EmailUsageFilterToolbar isInbound={false} />);
    fireEvent.click(screen.getByTestId("change-date"));
    const updater = h.setQueryParams.mock.calls[0][0] as (p: object) => { startDate: string; endDate: string };
    const result = updater({});
    expect(result.startDate).toBe("2024-01-01T00:00:00.000Z");
    expect(result.endDate).toBe("2024-02-01T00:00:00.000Z");
  });

  it("resets all filters to their defaults", () => {
    render(<EmailUsageFilterToolbar isInbound={false} />);
    fireEvent.click(screen.getByTestId("reset"));
    expect(h.setQueryParams).toHaveBeenCalledWith(null);
  });
});
