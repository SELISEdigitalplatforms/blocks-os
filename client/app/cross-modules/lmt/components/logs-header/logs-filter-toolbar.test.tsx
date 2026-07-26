import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LogsViewerContext } from "../logs-viewer";

const h = vi.hoisted(() => ({
  captured: null as {
    filters: { key: string }[];
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
    filters: { key: string }[];
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
      { id: "s1", label: "Svc One", serviceName: "s1" },
      { id: "s2", label: "Svc Two", serviceName: "s2" },
    ],
    selectedService: { id: "s1", label: "Svc One", serviceName: "s1" },
    changeService: vi.fn(),
    filter: { level: "", startDate: "", endDate: "", search: "" },
    setFilter: vi.fn(),
    resetFilter: vi.fn(),
    isSourceBlocks: true,
    subService: "all",
    setSubService: vi.fn(),
    isManagedLoading: false,
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

  it("includes the sub-service filter for blocks sources", () => {
    renderToolbar(makeCtx({ isSourceBlocks: true }));
    expect(screen.getByText("filter:subService")).toBeTruthy();
  });

  it("omits the sub-service filter for non-blocks sources", () => {
    renderToolbar(makeCtx({ isSourceBlocks: false }));
    expect(screen.queryByText("filter:subService")).toBeNull();
  });

  it("hides the global reset button when only the service differs from defaults", () => {
    renderToolbar(makeCtx({ filter: { level: "", startDate: "", endDate: "", search: "" } }));
    expect(screen.getByTestId("filter-toolbar").getAttribute("data-hide")).toBe("true");
  });

  it("shows the global reset button once a real filter is applied", () => {
    renderToolbar(makeCtx({ filter: { level: "", startDate: "", endDate: "", search: "abc" } }));
    expect(screen.getByTestId("filter-toolbar").getAttribute("data-hide")).toBe("false");
  });

  it("routes a service change to changeService with the matched service", () => {
    const ctx = makeCtx();
    renderToolbar(ctx);
    h.captured?.onChange("service", "s2");
    expect(ctx.changeService).toHaveBeenCalledWith(
      expect.objectContaining({ id: "s2" }),
    );
  });

  it("ignores a service change for an unknown service id", () => {
    const ctx = makeCtx();
    renderToolbar(ctx);
    h.captured?.onChange("service", "missing");
    expect(ctx.changeService).not.toHaveBeenCalled();
  });

  it("routes a sub-service change to setSubService", () => {
    const ctx = makeCtx();
    renderToolbar(ctx);
    h.captured?.onChange("subService", "worker");
    expect(ctx.setSubService).toHaveBeenCalledWith("worker");
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

  it("resets the filter and the sub-service together", () => {
    const ctx = makeCtx();
    renderToolbar(ctx);
    h.captured?.onReset();
    expect(ctx.resetFilter).toHaveBeenCalledTimes(1);
    expect(ctx.setSubService).toHaveBeenCalledWith("all");
  });
});
