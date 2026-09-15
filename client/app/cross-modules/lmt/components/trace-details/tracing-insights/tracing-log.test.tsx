import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  logs: [] as Record<string, unknown>[],
}));

// Only the log rows are under test here, so the surrounding data sources and the heavy
// sibling widgets are stubbed down to the shape this component reads.
vi.mock("@blocks-lmt/hooks/use-log", () => ({
  useGetLogs: () => ({ isLoading: false, isFetching: false, data: { data: h.logs } }),
  useGetRestoredLogs: () => ({ isLoading: false, isFetching: false, data: undefined }),
}));
vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("react-router", () => ({ useSearchParams: () => [new URLSearchParams()] }));
vi.mock("@/components/filter-toolbar", () => ({
  FilterControls: { SearchInput: () => <input aria-label="Search logs" /> },
}));
vi.mock("../../log-stack-trace", () => ({ LogStackTrace: () => null }));
// Standalone context: the real trace-details module pulls in the whole timeline tree.
vi.mock("../trace-details", async () => {
  const react = await import("react");
  return {
    timelineContext: react.createContext({
      traceHistory: [{ current: { traceId: "t-1", spanId: "s-1", serviceName: "blocks-iam" } }],
    }),
  };
});

import { TracingLog } from "./tracing-log";

const log = (level: string) => ({
  timestamp: "2026-09-08T12:08:51.000Z",
  level,
  message: `a ${level} line`,
  traceId: "t-1",
  spanId: "s-1",
  exception: "",
});

describe("TracingLog", () => {
  beforeEach(() => {
    h.logs = [];
  });

  it("shortens Information to INFO, as the logs list does", () => {
    h.logs = [log("Information")];
    render(<TracingLog />);

    expect(screen.getByText("INFO")).toBeTruthy();
    expect(screen.queryByText("Information")).toBeNull();
  });

  it("shortens Warning to WARN", () => {
    h.logs = [log("Warning")];
    render(<TracingLog />);

    expect(screen.getByText("WARN")).toBeTruthy();
    expect(screen.queryByText("Warning")).toBeNull();
  });

  it("leaves an already-short level alone", () => {
    h.logs = [log("Error")];
    render(<TracingLog />);

    expect(screen.getByText("Error")).toBeTruthy();
  });
});
