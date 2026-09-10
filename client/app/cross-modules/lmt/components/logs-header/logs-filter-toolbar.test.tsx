import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LogsViewerContext } from "../logs-viewer";

type CapturedFilter = {
  key: string;
  props?: {
    options?: { label: string; value: string; children?: { label: string; value: string }[] }[];
  };
};

const h = vi.hoisted(() => ({
  captured: null as {
    filters: { key: string; props?: unknown }[];
    onChange: (key: string, value: unknown) => void;
    onReset: () => void;
    hideGlobalResetButton?: boolean;
  } | null,
}));

// Keep the heavy sibling tree (Ask-AI sheet, log list) out of the module graph
// so importing the LogsViewer context module stays light in jsdom.
vi.mock("./logs-header", () => ({ LogsListHeader: () => null }));
vi.mock("../logs-list", () => ({ LogsList: () => null }));

vi.mock("@/components/filter-toolbar", () => ({
  FilterToolbar: (props: {
    filters: { key: string; props?: unknown }[];
    onChange: (key: string, value: unknown) => void;
    onReset: () => void;
    hideGlobalResetButton?: boolean;
  }) => {
    h.captured = props;
    return (
      <div data-testid="filter-toolbar" data-hide={String(props.hideGlobalResetButton)}>
        {props.filters.map((f) => (
          <span key={f.key}>filter:{f.key}</span>
        ))}
      </div>
    );
  },
}));

import { LogsFilterToolbar } from "./logs-filter-toolbar";

type Ctx = React.ContextType<typeof LogsViewerContext>;

const makeCtx = (over: Partial<Ctx> = {}): Ctx =>
  ({
    pageSize: 20,
    services: [
      {
        id: "s1",
        label: "Svc One",
        serviceName: "s1",
        components: [
          { label: "API", value: "s1-api" },
          { label: "Worker", value: "s1-worker" },
        ],
      },
      { id: "s2", label: "Svc Two", serviceName: "s2" },
    ],
    selectedService: { id: "s1", label: "Svc One", serviceName: "s1" },
    serviceFilterValue: "s1",
    changeService: vi.fn(),
    changeServices: vi.fn(),
    filter: { level: "", startDate: "", endDate: "", search: "" },
    setFilter: vi.fn(),
    resetFilter: vi.fn(),
    isSourceBlocks: true,
    isServicesLoading: false,
    ...over,
  }) as unknown as Ctx;

const renderToolbar = (ctx: Ctx) =>
  render(
    <LogsViewerContext.Provider value={ctx}>
      <LogsFilterToolbar />
    </LogsViewerContext.Provider>,
  );

describe("LogsFilterToolbar", () => {
  afterEach(() => cleanup());

  it("hides the reset button while every filter is at its default", () => {
    // The list opens on the default relative window, so that counts as pristine.
    renderToolbar(
      makeCtx({ filter: { level: "", startDate: "", endDate: "", search: "", range: "30m" } }),
    );
    expect(screen.getByTestId("filter-toolbar").getAttribute("data-hide")).toBe("true");
  });

  it("shows the reset button once a non-default service is selected", () => {
    renderToolbar(makeCtx({ serviceFilterValue: "s2" }));
    expect(screen.getByTestId("filter-toolbar").getAttribute("data-hide")).toBe("false");
  });

  it("shows the reset button once the default service is narrowed to a component", () => {
    renderToolbar(makeCtx({ serviceFilterValue: "s1::s1-api" }));
    expect(screen.getByTestId("filter-toolbar").getAttribute("data-hide")).toBe("false");
  });

  it("shows the reset button once a real filter is applied", () => {
    renderToolbar(makeCtx({ filter: { level: "", startDate: "", endDate: "", search: "abc" } }));
    expect(screen.getByTestId("filter-toolbar").getAttribute("data-hide")).toBe("false");
  });

  it("routes a service change to changeServices", () => {
    const ctx = makeCtx();
    renderToolbar(ctx);
    h.captured?.onChange("service", ["s2"]);
    expect(ctx.changeServices).toHaveBeenCalledWith(["s2"]);
  });

  it("drops values for unknown service ids", () => {
    const ctx = makeCtx();
    renderToolbar(ctx);
    h.captured?.onChange("service", ["missing", "s2"]);
    expect(ctx.changeServices).toHaveBeenCalledWith(["s2"]);
  });

  it("passes an empty selection through so the viewer can fall back", () => {
    const ctx = makeCtx();
    renderToolbar(ctx);
    h.captured?.onChange("service", []);
    expect(ctx.changeServices).toHaveBeenCalledWith([]);
  });

  it("keeps several services and components in one selection", () => {
    const ctx = makeCtx();
    renderToolbar(ctx);
    h.captured?.onChange("service", ["s1::s1-worker", "s2"]);
    expect(ctx.changeServices).toHaveBeenCalledWith(["s1::s1-worker", "s2"]);
  });

  it("maps the service key back to a checkbox selection across services", () => {
    const ctx = makeCtx({ serviceFilterValue: "s1::s1-api,s1-worker;s2" });
    renderToolbar(ctx);
    expect((h.captured as unknown as { values: { service: string[] } }).values.service).toEqual([
      "s1::s1-api",
      "s1::s1-worker",
      "s2",
    ]);
  });

  it("builds nested checkbox-tree children from each service's components", () => {
    const ctx = makeCtx();
    renderToolbar(ctx);
    const filters = h.captured?.filters as unknown as CapturedFilter[];
    const serviceFilter = filters.find((f) => f.key === "service");
    expect(serviceFilter?.props?.options).toEqual([
      {
        label: "Svc One",
        value: "s1",
        children: [
          { label: "API", value: "s1::s1-api" },
          { label: "Worker", value: "s1::s1-worker" },
        ],
      },
      { label: "Svc Two", value: "s2", children: undefined },
    ]);
  });

  it("shows shortened labels for the Type filter while keeping full values", () => {
    const ctx = makeCtx();
    renderToolbar(ctx);
    const filters = h.captured?.filters as unknown as CapturedFilter[];
    const levelFilter = filters.find((f) => f.key === "level");
    expect(levelFilter?.props?.options).toEqual([
      { label: "INFO", value: "Information" },
      { label: "WARN", value: "Warning" },
      { label: "Error", value: "Error" },
    ]);
  });

  it("converts a chosen window into ISO start and end dates", () => {
    const ctx = makeCtx();
    renderToolbar(ctx);
    const from = new Date("2024-01-01T00:00:00.000Z");
    const to = new Date("2024-01-31T00:00:00.000Z");
    h.captured?.onChange("timeRange", { from, to });
    const updater = (ctx.setFilter as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updater({ range: "30m" })).toEqual({
      startDate: from.toISOString(),
      endDate: to.toISOString(),
      // An explicit window supersedes the relative default rather than stacking with it.
      range: "",
    });
  });

  it("leaves the end open when only a start is chosen", () => {
    const ctx = makeCtx();
    renderToolbar(ctx);
    const from = new Date("2024-01-01T00:00:00.000Z");
    h.captured?.onChange("timeRange", { from });
    const updater = (ctx.setFilter as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // An open end is what keeps the list tailing, so it must not be pinned to a timestamp.
    expect(updater({ range: "30m" })).toEqual({
      startDate: from.toISOString(),
      endDate: "",
      range: "",
    });
  });

  it("returns to the default relative window when the range is reset", () => {
    const ctx = makeCtx();
    renderToolbar(ctx);
    h.captured?.onChange("timeRange", null);
    const updater = (ctx.setFilter as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updater({ startDate: "x", endDate: "y" })).toEqual({
      startDate: "",
      endDate: "",
      range: "30m",
    });
  });

  it("offers no relative presets and hands the picker the default window", () => {
    const ctx = makeCtx();
    renderToolbar(ctx);
    const filters = h.captured?.filters as unknown as CapturedFilter[];
    const timeRangeFilter = filters.find((f) => f.key === "timeRange") as unknown as {
      props?: { presets?: unknown; defaultRange?: { from?: Date; to?: Date }; openEndHint?: string };
    };
    expect(timeRangeFilter.props?.presets).toBeUndefined();
    // Logs tail live, so an open end is worth advertising as such here.
    expect(timeRangeFilter.props?.openEndHint).toMatch(/keeps streaming/i);
    // The default window is the last 30 minutes, left open at the end so it keeps streaming.
    // Floored, not rounded: the start is pinned to the top of the current minute, so the gap
    // is 30 minutes plus however far into that minute the test happens to run.
    const from = timeRangeFilter.props?.defaultRange?.from as Date;
    expect(Math.floor((Date.now() - from.getTime()) / 60_000)).toBe(30);
    expect(timeRangeFilter.props?.defaultRange?.to).toBeUndefined();
  });

  it("treats the default relative window as no explicit range", () => {
    const ctx = makeCtx();
    renderToolbar(ctx);
    // Nothing absolute is set, so the picker is handed null and the Reset chip stays hidden.
    expect((h.captured as unknown as { values: { timeRange: unknown } }).values.timeRange).toBeNull();
  });

  it("updates a plain filter key such as search", () => {
    const ctx = makeCtx();
    renderToolbar(ctx);
    h.captured?.onChange("search", "hello");
    const updater = (ctx.setFilter as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updater({ level: "" })).toEqual({ level: "", search: "hello" });
  });

  it("resets the filters and puts the service back to the default", () => {
    const ctx = makeCtx({ serviceFilterValue: "s2" });
    renderToolbar(ctx);
    h.captured?.onReset();
    expect(ctx.resetFilter).toHaveBeenCalledTimes(1);
    expect(ctx.changeServices).toHaveBeenCalledWith([]);
  });

  /**
   * Restored rows are a closed set of days, always older than any relative window. The hot
   * default -- the last 30 minutes -- would return nothing over them every single time, which a
   * reader would read as "this restore has no logs".
   */
  describe("over a restored window", () => {
    const restoredCtx = () =>
      makeCtx({
        tier: "cold",
        restoreRequestId: "req-1",
        restoreWindow: { startDate: "2026-08-01T00:00:00Z", endDate: "2026-08-07T00:00:00Z" },
      } as Partial<Ctx>);

    const timeRangeProps = () => {
      const filters = (h.captured?.filters ?? []) as CapturedFilter[];
      const timeRange = filters.find((f) => f.key === "timeRange") as unknown as {
        props?: {
          defaultRange?: unknown;
          openEndHint?: string;
          bounds?: { min?: Date; max?: Date };
        };
      };
      return timeRange.props ?? {};
    };

    it("offers no relative default window", () => {
      renderToolbar(restoredCtx());

      expect(timeRangeProps().defaultRange ?? null).toBeNull();
    });

    it("bounds the picker to the days the restore covers", () => {
      renderToolbar(restoredCtx());

      expect(timeRangeProps().bounds?.min).toEqual(new Date(2026, 7, 1));
      expect(timeRangeProps().bounds?.max).toEqual(new Date(2026, 7, 7));
    });

    it("promises no streaming, because a closed window has nothing to stream", () => {
      renderToolbar(restoredCtx());

      expect(timeRangeProps().openEndHint).not.toMatch(/keeps streaming/i);
    });

    it("still offers search, service and level", () => {
      renderToolbar(restoredCtx());

      const keys = (h.captured?.filters ?? []).map((f) => f.key);
      expect(keys).toContain("search");
      expect(keys).toContain("service");
      expect(keys).toContain("level");
    });

    it("enforces only the end it knows, while the window is still loading", () => {
      renderToolbar(
        makeCtx({
          tier: "cold",
          restoreRequestId: "req-1",
          restoreWindow: {},
        } as Partial<Ctx>),
      );

      expect(timeRangeProps().bounds?.min).toBeUndefined();
      expect(timeRangeProps().bounds?.max).toBeUndefined();
    });
  });
});
