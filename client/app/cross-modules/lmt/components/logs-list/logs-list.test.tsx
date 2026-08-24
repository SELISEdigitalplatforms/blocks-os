import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  initialLogs: [] as unknown[],
  isLoading: false,
  hasTopMore: false,
  fetchOldLogs: vi.fn(),
  fetchNewLogs: vi.fn(),
  serviceNames: [] as string[],
  scrollMounts: 0,
}));

vi.mock("../../hooks/use-logs", () => ({
  useLogs: ({ serviceNames }: { serviceNames?: string[] }) => {
    h.serviceNames = serviceNames ?? [];
    return {
      initialLogs: h.initialLogs,
      isLoading: h.isLoading,
      hasTopMore: h.hasTopMore,
      fetchOldLogs: h.fetchOldLogs,
      fetchNewLogs: h.fetchNewLogs,
    };
  },
}));
vi.mock("../logs-header/logs-filter-toolbar", () => ({
  LogsFilterToolbar: () => <div data-testid="filter-toolbar" />,
}));
vi.mock("./log-item", () => ({
  LogItem: ({ log }: { log: { traceId: string } }) => <span>{log.traceId}</span>,
}));
vi.mock("@/components/infinite-scroller", async () => {
  const react = await import("react");
  return {
    // Counts mounts so a reset (a new key) can be told apart from a plain re-render.
    InfiniteScroll: () => {
      react.useEffect(() => {
        h.scrollMounts += 1;
      }, []);
      return <div data-testid="infinite-scroll" />;
    },
  };
});
// The real logs-viewer module pulls in blocks-kit (which touches process.env at
// import); provide a standalone context so only LogsList is under test.
vi.mock("../logs-viewer", async () => {
  const react = await import("react");
  return { LogsViewerContext: react.createContext({}) };
});

import { LogsList } from "./logs-list";
import { LogsViewerContext } from "../logs-viewer";

const contextValue = (value: Partial<React.ContextType<typeof LogsViewerContext>>) =>
  ({
    selectedService: { serviceName: "svc", serviceNames: ["svc"] },
    selectedServiceNames: ["svc"],
    filter: { level: "", startDate: "", endDate: "", search: "" },
    pageSize: 20,
    isServicesLoading: false,
    isSourceBlocks: true,
    services: [{ id: "svc", label: "Svc", serviceName: "svc" }],
    ...value,
  }) as React.ContextType<typeof LogsViewerContext>;

const renderWithContext = (value: Partial<React.ContextType<typeof LogsViewerContext>>) => {
  const utils = render(
    <LogsViewerContext.Provider value={contextValue(value)}>
      <LogsList />
    </LogsViewerContext.Provider>,
  );
  return {
    ...utils,
    rerenderWith: (next: Partial<React.ContextType<typeof LogsViewerContext>>) =>
      utils.rerender(
        <LogsViewerContext.Provider value={contextValue(next)}>
          <LogsList />
        </LogsViewerContext.Provider>,
      ),
  };
};

describe("LogsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.initialLogs = [];
    h.isLoading = false;
    h.hasTopMore = false;
    h.serviceNames = [];
    h.scrollMounts = 0;
  });

  it("shows the services loading state", () => {
    renderWithContext({ isServicesLoading: true });
    expect(screen.getByText("Loading services...")).toBeTruthy();
  });

  it("shows an empty state when there are no services", () => {
    renderWithContext({ services: [] });
    expect(screen.getByText("No services found.")).toBeTruthy();
  });

  it("shows skeletons while logs are loading", () => {
    h.isLoading = true;
    const { container } = renderWithContext({});
    expect(container.querySelectorAll("[class*='rounded-lg']").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("infinite-scroll")).toBeNull();
  });

  it("renders the infinite scroll list when logs are ready", () => {
    renderWithContext({});
    expect(screen.getByTestId("infinite-scroll")).toBeTruthy();
    expect(screen.getByTestId("filter-toolbar")).toBeTruthy();
  });

  it("queries every selected service, keeping the primary one as the fallback", () => {
    renderWithContext({
      selectedService: { id: "a", label: "A", serviceName: "a-api" },
      selectedServiceNames: ["a-api", "b-api"],
    });
    expect(h.serviceNames).toEqual(["a-api", "b-api"]);
  });

  it("resets the scroll list when the queried services change", () => {
    const { rerenderWith } = renderWithContext({ selectedServiceNames: ["a-api"] });
    expect(h.scrollMounts).toBe(1);

    rerenderWith({ selectedServiceNames: ["a-api"] });
    expect(h.scrollMounts).toBe(1);

    rerenderWith({ selectedServiceNames: ["b-api"] });
    expect(h.scrollMounts).toBe(2);
  });
});
