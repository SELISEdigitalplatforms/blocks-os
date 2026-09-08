import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

type CapturedFilter = {
  key: string;
  type: string;
  props?: { presets?: unknown; timeZone?: string; defaultRange?: unknown };
};

const h = vi.hoisted(() => ({
  captured: null as {
    filters: CapturedFilter[];
    values: Record<string, unknown>;
    defaultValues: Record<string, unknown>;
    onChange: (key: string, value: unknown) => void;
    onReset: () => void;
  } | null,
}));

vi.mock("@/components/filter-toolbar", () => ({
  FilterToolbar: (props: {
    filters: CapturedFilter[];
    values: Record<string, unknown>;
    defaultValues: Record<string, unknown>;
    onChange: (key: string, value: unknown) => void;
    onReset: () => void;
  }) => {
    h.captured = props;
    return (
      <div data-testid="filter-toolbar">
        {props.filters.map((f) => (
          <span key={f.key}>filter:{f.key}</span>
        ))}
      </div>
    );
  },
  useSortQueryParams: () => [{ property: "Timestamp", isDescending: true }, vi.fn()],
}));

import { TracesFilterToolbar, type TraceFilter } from "./traces-filter-toolbar";

const EMPTY: TraceFilter = {
  search: "",
  services: [],
  status: [],
  startDate: "",
  endDate: "",
};

const renderToolbar = (
  queryParams: Partial<TraceFilter> = {},
  showTimeRange = true,
  setQueryParams = vi.fn(),
) => {
  render(
    <TracesFilterToolbar
      queryParams={{ ...EMPTY, ...queryParams }}
      setQueryParams={setQueryParams as never}
      serviceOptions={[{ label: "Svc One", value: "s1" }]}
      showTimeRange={showTimeRange}
    />,
  );
  return setQueryParams;
};

const timeRangeFilter = () => h.captured?.filters.find((f) => f.key === "timeRange");
const updaterFrom = (setQueryParams: ReturnType<typeof vi.fn>) =>
  setQueryParams.mock.calls[0][0] as (params: Record<string, unknown>) => Record<string, unknown>;

describe("TracesFilterToolbar", () => {
  afterEach(() => cleanup());

  it("offers a window picker in local time rather than relative presets", () => {
    renderToolbar();

    // Trace rows are listed in local time, so the window has to be written in the same clock.
    expect(timeRangeFilter()?.type).toBe("TimeRange");
    expect(timeRangeFilter()?.props?.timeZone).toBe("local");
    expect(timeRangeFilter()?.props?.presets).toBeUndefined();
    expect(h.captured?.filters.some((f) => f.key === "range")).toBe(false);
    expect(screen.queryByText("filter:range")).toBeNull();
  });

  it("opens with no window applied, so every trace is in scope", () => {
    renderToolbar();

    expect(h.captured?.values.timeRange).toBeNull();
    expect(h.captured?.defaultValues.timeRange).toBeNull();
    // Nothing to fall back to: unlike logs, the trace list does not open on a window.
    expect(timeRangeFilter()?.props?.defaultRange).toBeUndefined();
  });

  it("writes a chosen window into the start and end query params", () => {
    const setQueryParams = renderToolbar();
    const from = new Date(2026, 8, 8, 11, 9);
    const to = new Date(2026, 8, 8, 11, 39);

    h.captured?.onChange("timeRange", { from, to });

    expect(updaterFrom(setQueryParams)({})).toEqual({
      startDate: from.toISOString(),
      endDate: to.toISOString(),
      page: 0,
    });
  });

  it("leaves the end empty when only a start is chosen", () => {
    const setQueryParams = renderToolbar();
    const from = new Date(2026, 8, 8, 11, 9);

    h.captured?.onChange("timeRange", { from });

    expect(updaterFrom(setQueryParams)({})).toEqual({
      startDate: from.toISOString(),
      endDate: "",
      page: 0,
    });
  });

  it("clears both ends when the window is reset", () => {
    const setQueryParams = renderToolbar({ startDate: "2026-09-08T05:09:00.000Z" });

    h.captured?.onChange("timeRange", null);

    expect(updaterFrom(setQueryParams)({})).toEqual({ startDate: "", endDate: "", page: 0 });
  });

  it("hands the stored window back to the picker as dates", () => {
    const from = new Date(2026, 8, 8, 11, 9);
    const to = new Date(2026, 8, 8, 11, 39);
    renderToolbar({ startDate: from.toISOString(), endDate: to.toISOString() });

    expect(h.captured?.values.timeRange).toEqual({ from, to });
  });

  it("keeps the window picker off the tabs that opt out of it", () => {
    // Cold and archived traces are older than any window this control would offer.
    renderToolbar({}, false);

    expect(timeRangeFilter()).toBeUndefined();
  });
});
