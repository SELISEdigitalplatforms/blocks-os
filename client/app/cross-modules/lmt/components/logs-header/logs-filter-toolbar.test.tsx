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
    renderToolbar(makeCtx({ filter: { level: "", startDate: "", endDate: "", search: "" } }));
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

  it("converts a date range into ISO start and end dates", () => {
    const ctx = makeCtx();
    renderToolbar(ctx);
    const from = new Date("2024-01-01T00:00:00.000Z");
    const to = new Date("2024-01-31T00:00:00.000Z");
    h.captured?.onChange("date", { from, to });
    const updater = (ctx.setFilter as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updater({})).toEqual({
      startDate: from.toISOString(),
      endDate: to.toISOString(),
    });
  });

  it("clears the dates when the range is null", () => {
    const ctx = makeCtx();
    renderToolbar(ctx);
    h.captured?.onChange("date", null);
    const updater = (ctx.setFilter as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updater({})).toEqual({ startDate: "", endDate: "" });
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
});
