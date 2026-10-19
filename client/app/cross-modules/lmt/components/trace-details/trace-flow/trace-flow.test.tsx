import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TraceTree } from "@blocks-lmt/models/trace.model";
import type { TraceFlowSceneOptions } from "./trace-flow-scene";

const h = vi.hoisted(() => ({
  mode: "ready" as "ready" | "unsupported",
  normalLogs: vi.fn(),
  restoredLogs: vi.fn(),
  opts: null as TraceFlowSceneOptions | null,
  scene: {
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    setSpeed: vi.fn(),
    dispose: vi.fn(),
    setOverview: vi.fn(),
    zoom: vi.fn(),
    resetCamera: vi.fn(),
  },
}));

// jsdom has no WebGL, so the three.js scene is replaced by a recorder of the calls made to it.
vi.mock("./trace-flow-scene", () => ({
  createTraceFlowScene: (_host: HTMLElement, _flow: unknown, opts: TraceFlowSceneOptions) => {
    if (h.mode === "unsupported") throw new Error("WebGL unavailable");
    h.opts = opts;
    opts.onStepChange(0, false);
    opts.onPlayingChange(true);
    return h.scene;
  },
}));

// The context lives in trace-details, whose data hooks would pull in the real HTTP client.
vi.mock("@blocks-lmt/hooks/use-trace", () => ({
  useGetTraceById: () => ({}),
  useGetRestoredTraceById: () => ({}),
}));
vi.mock("@blocks-lmt/hooks/use-log", () => ({
  useGetLogs: (...args: unknown[]) => h.normalLogs(...args),
  useGetRestoredLogs: (...args: unknown[]) => h.restoredLogs(...args),
}));

import { timelineContext } from "../trace-details";
import { TraceFlowView } from "./trace-flow";

let seq = 0;
const span = (overrides: Partial<TraceTree> = {}): TraceTree =>
  ({
    timestamp: "2024-01-01T10:00:00.000Z",
    traceId: "trace-1",
    spanId: `span-${++seq}`,
    parentSpanId: "",
    parentId: "",
    kind: "Internal",
    activitySourceName: "src",
    operationName: "op",
    startTime: "2024-01-01T10:00:00.000Z",
    endTime: "2024-01-01T10:00:00.100Z",
    duration: 12,
    attributes: {},
    status: "Ok",
    statusDescription: "",
    baggage: { TenantId: "t", IsFromCloud: "false" },
    serviceName: "blocks-iam",
    entryPoint: { method: "", actionName: "" },
    issues: [],
    tags: { ecosystem: "", habitat: "", uriClient: "" },
    securityContext: {} as TraceTree["securityContext"],
    request: {} as TraceTree["request"],
    response: {} as TraceTree["response"],
    logs: [],
    subEntries: [],
    ...overrides,
  }) as TraceTree;

const failingTrace = () =>
  span({
    kind: "Server",
    operationName: "POST /oidc/token",
    attributes: { "response.status.code": 500 },
    status: "Unset",
    subEntries: [
      span({
        operationName: "Redis::Get",
        kind: "Producer",
        startTime: "2024-01-01T10:00:00.010Z",
      }),
      span({
        operationName: "MongoDb::insert",
        kind: "Producer",
        status: "Error",
        statusDescription: "E11000 duplicate key",
        startTime: "2024-01-01T10:00:00.020Z",
      }),
    ],
  });

const renderView = (
  trace: TraceTree | null,
  { isLoading = false, requestId }: { isLoading?: boolean; requestId?: string } = {},
) => {
  const setSelectedTrace = vi.fn();
  const utils = render(
    <timelineContext.Provider
      value={{
        traceHistory: trace ? [{ rootId: trace.spanId, root: trace, current: trace }] : [],
        setTraceHistory: vi.fn(),
        selectedTrace: null,
        setSelectedTrace,
        isPanelOpen: true,
        isLoading,
        requestId,
      }}
    >
      <TraceFlowView />
    </timelineContext.Provider>,
  );
  return { ...utils, setSelectedTrace };
};

describe("TraceFlowView story", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.mode = "ready";
    h.opts = null;
    const result = {
      data: { data: [], totalCount: 0 },
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    };
    h.normalLogs.mockReturnValue(result);
    h.restoredLogs.mockReturnValue(result);
  });

  it("keeps raw data and 3D controls out of the first frame", () => {
    renderView(failingTrace());
    expect(screen.getByRole("region", { name: "Request story" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "The request arrives" })).toBeTruthy();
    expect(screen.queryByRole("complementary", { name: "Selected transfer" })).toBeNull();
    expect(h.opts).toBeNull();
    expect(screen.getByRole("button", { name: "Play story" })).toBeTruthy();
  });

  it("shows a placeholder during loading", () => {
    renderView(null, { isLoading: true });
    expect(screen.queryByRole("region", { name: "Request story" })).toBeNull();
  });

  it("selects a chapter and keeps the span insights in sync", async () => {
    const { setSelectedTrace } = renderView(failingTrace());
    await userEvent.click(screen.getByRole("button", { name: /Checking the cache Redis/ }));
    expect(screen.getByRole("heading", { name: "Checking the cache" })).toBeTruthy();
    expect(setSelectedTrace).toHaveBeenLastCalledWith(
      expect.objectContaining({ operationName: "Redis::Get" }),
    );
    expect(screen.getByText("blocks-iam looks for cached data in Redis.")).toBeTruthy();
  });

  it("opens recorded details only on request and redacts secret fields", async () => {
    renderView(
      span({
        kind: "Server",
        attributes: { authorization: "private-value", "db.collection.name": "Orders" },
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "View this moment" }));
    const inspector = screen.getByRole("complementary", { name: "Selected transfer" });
    await userEvent.click(within(inspector).getByRole("tab", { name: "Attributes" }));
    expect(within(inspector).getByText("[redacted]")).toBeTruthy();
    expect(screen.queryByText("private-value")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Close details" }));
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("jumps to the recorded error and gives it a narrative frame", async () => {
    renderView(failingTrace());
    await userEvent.click(screen.getByRole("button", { name: /An error was recorded/ }));
    expect(screen.getByRole("heading", { name: "This is where it failed" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("E11000 duplicate key");
    expect(screen.getByRole("button", { name: "Next moment" }).hasAttribute("disabled")).toBe(true);
  });

  it("lets the reader scrub and step through moments", async () => {
    const { setSelectedTrace } = renderView(failingTrace());
    fireEvent.change(screen.getByLabelText("Story position"), { target: { value: "2" } });
    expect(setSelectedTrace).toHaveBeenLastCalledWith(
      expect.objectContaining({ operationName: "MongoDb::insert" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Previous moment" }));
    expect(setSelectedTrace).toHaveBeenLastCalledWith(
      expect.objectContaining({ operationName: "Redis::Get" }),
    );
  });

  it("plays, pauses, finishes, and restarts without requiring WebGL", () => {
    vi.useFakeTimers();
    try {
      renderView(failingTrace());
      fireEvent.click(screen.getByRole("button", { name: "Play story" }));
      act(() => vi.advanceTimersByTime(3200));
      expect(screen.getByRole("heading", { name: "Checking the cache" })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Pause story" }));
      act(() => vi.advanceTimersByTime(6400));
      expect(screen.getByRole("heading", { name: "Checking the cache" })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Play story" }));
      act(() => vi.advanceTimersByTime(3200));
      act(() => vi.advanceTimersByTime(3200));
      expect(screen.getByRole("heading", { name: "The journey, complete." })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Replay story" }));
      expect(screen.getByRole("heading", { name: "The request arrives" })).toBeTruthy();
      expect(h.opts).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("loads the 3D map on demand and disposes it when returning to the story", async () => {
    renderView(failingTrace());
    await userEvent.click(screen.getByRole("button", { name: "Explore 3D" }));
    await waitFor(() => expect(h.opts).not.toBeNull());
    act(() => h.opts!.onNodeSelect!("cache:redis"));
    expect(screen.getByRole("heading", { name: "Checking the cache" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Back to story" }));
    expect(h.scene.dispose).toHaveBeenCalledTimes(1);
  });

  it("keeps the story usable if WebGL is unavailable", async () => {
    h.mode = "unsupported";
    renderView(failingTrace());
    await userEvent.click(screen.getByRole("button", { name: "Explore 3D" }));
    expect(await screen.findByText(/The 3D map needs WebGL/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Back to story" }));
    await userEvent.click(screen.getByRole("button", { name: "Next moment" }));
    expect(screen.getByRole("heading", { name: "Checking the cache" })).toBeTruthy();
  });

  it("does not invent a cache hit or miss when it was not captured", async () => {
    renderView(failingTrace());
    await userEvent.click(screen.getByRole("button", { name: /Checking the cache Redis/ }));
    expect(screen.queryByText(/records a cache hit|records a cache miss/)).toBeNull();
  });
  it("loads log evidence on demand for the producing service and exact trace/span", async () => {
    const trace = failingTrace();
    h.normalLogs.mockReturnValue({
      data: {
        totalCount: 1,
        data: [
          {
            traceId: trace.traceId,
            spanId: trace.spanId,
            serviceName: trace.serviceName,
            timestamp: "2026-10-19T10:00:00Z",
            level: "Information",
            message: "Request accepted by the service",
          },
        ],
      },
    });
    renderView(trace);
    expect(h.normalLogs).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "View evidence" }));
    expect(h.normalLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceName: trace.serviceName,
        filter: { traceId: trace.traceId, spanId: trace.spanId },
      }),
      { enabled: true },
    );
    expect(screen.getByText("Request accepted by the service")).toBeTruthy();
    expect(screen.getByText("L1")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Next moment" }));
    expect(screen.queryByText("Request accepted by the service")).toBeNull();
    expect(screen.getByText(/No matching log records/)).toBeTruthy();
  });

  it("uses restored evidence for a restored trace", async () => {
    renderView(failingTrace(), { requestId: "restored-42" });
    await userEvent.click(screen.getByRole("button", { name: "View evidence" }));
    expect(h.normalLogs).toHaveBeenCalledWith(expect.anything(), { enabled: false });
    expect(h.restoredLogs).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "restored-42" }),
      { enabled: true },
    );
  });

  it("shows evidence failures as failures and allows retry", async () => {
    const refetch = vi.fn();
    h.normalLogs.mockReturnValue({ isError: true, refetch });
    renderView(failingTrace());
    await userEvent.click(screen.getByRole("button", { name: "View evidence" }));
    expect(
      screen
        .getAllByRole("alert")
        .some((node) => node.textContent?.includes("could not be loaded")),
    ).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/No matching log records/)).toBeNull();
  });

  it("pages evidence and resets the page when selecting another moment", async () => {
    h.normalLogs.mockReturnValue({ data: { totalCount: 30, data: [] } });
    renderView(failingTrace());
    await userEvent.click(screen.getByRole("button", { name: "View evidence" }));
    await userEvent.click(screen.getByRole("button", { name: "Next records" }));
    expect(h.normalLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1 }),
      expect.anything(),
    );
    await userEvent.click(screen.getByRole("button", { name: "Next moment" }));
    expect(h.normalLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 0 }),
      expect.anything(),
    );
  });

  it("does not misrepresent unknown outcomes or zero result counts", async () => {
    const trace = span({
      kind: "Producer",
      operationName: "MongoDb::find",
      status: "Unset",
      attributes: { "db.collection.name": "Orders", "result.count": 0 },
    });
    renderView(trace);
    expect(screen.getByText("A completion outcome was not recorded.")).toBeTruthy();
    expect(screen.getByText("Recorded count")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.queryByText("The operation reported success.")).toBeNull();
  });
});
