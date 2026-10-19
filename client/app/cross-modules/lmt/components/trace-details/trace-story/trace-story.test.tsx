import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TraceTree } from "@blocks-lmt/models/trace.model";

const h = vi.hoisted(() => ({
  normalLogs: vi.fn(),
  restoredLogs: vi.fn(),
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
import { TraceStoryView } from "./trace-story";
import { LOG_PAGE_SIZE } from "./trace-story-logs";
import { PLAY_STEP_MS } from "./trace-story";

let seq = 0;
const at = (ms: number) => new Date(Date.UTC(2024, 0, 1, 10, 0, 0, ms)).toISOString();
const span = (overrides: Partial<TraceTree> = {}): TraceTree =>
  ({
    timestamp: at(0),
    traceId: "trace-1",
    spanId: `span-${++seq}`,
    parentSpanId: "",
    parentId: "",
    kind: "Internal",
    activitySourceName: "src",
    operationName: "op",
    startTime: at(0),
    endTime: at(100),
    duration: 12,
    attributes: {},
    status: "Ok",
    statusDescription: "",
    baggage: { TenantId: "tenant-123456789", IsFromCloud: "false" },
    serviceName: "blocks-iam",
    entryPoint: { method: "POST", actionName: "/oidc/token" },
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
    duration: 100,
    attributes: { "response.status.code": 500 },
    status: "Unset",
    subEntries: [
      span({ operationName: "Redis::Get", kind: "Producer", startTime: at(10), duration: 3 }),
      span({
        operationName: "MongoDb::insert",
        kind: "Producer",
        status: "Error",
        statusDescription: "E11000 duplicate key",
        startTime: at(20),
        duration: 60,
        attributes: { "db.collection.name": "Users" },
      }),
    ],
  });

const okTrace = () =>
  span({
    kind: "Server",
    duration: 50,
    attributes: { "response.status.code": 200 },
    subEntries: [span({ operationName: "lookup", startTime: at(5), duration: 30 })],
  });

const logsResult = (overrides: Record<string, unknown> = {}) => ({
  data: { data: [], totalCount: 0 },
  isLoading: false,
  isFetching: false,
  isError: false,
  refetch: vi.fn(),
  ...overrides,
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
        selectedTrace: trace,
        setSelectedTrace,
        isLoading,
        requestId,
      }}
    >
      <TraceStoryView />
    </timelineContext.Provider>,
  );
  return { ...utils, setSelectedTrace };
};

// The log sheet is modal, so rows behind it are hidden from the accessibility tree.
const row = (name: RegExp) => screen.getByRole("button", { name, hidden: true });
const detail = () => within(screen.getByRole("complementary", { name: "Selected step" }));

describe("TraceStoryView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.normalLogs.mockReturnValue(logsResult());
    h.restoredLogs.mockReturnValue(logsResult());
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a placeholder while loading", () => {
    const { container } = renderView(null, { isLoading: true });
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("tells the story in one view: summary, plot line, a sentence and a bar per step", () => {
    renderView(failingTrace());
    expect(screen.getAllByText("/oidc/token").length).toBeGreaterThan(0);
    expect(screen.getAllByText("500").length).toBeGreaterThan(0);
    expect(screen.getByText("It broke at step 3.")).toBeTruthy();
    expect(screen.getAllByText(/E11000 duplicate key/).length).toBeGreaterThan(0);
    expect(row(/^Step 1: The request arrives/)).toBeTruthy();
    expect(row(/^Step 2: Checking the cache/)).toBeTruthy();
    expect(row(/^Step 3: This is where it failed/)).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /Waterfall|Story/ })).toBeNull();
    expect(screen.queryByText(/3D/)).toBeNull();
  });

  it("opens on the step where the error started and keeps the span panel in sync", async () => {
    const { setSelectedTrace } = renderView(failingTrace());
    expect(row(/^Step 3:/).getAttribute("aria-pressed")).toBe("true");
    expect(detail().getByText("Error started here: E11000 duplicate key")).toBeTruthy();
    await userEvent.click(row(/^Step 2:/));
    expect(detail().getByText("Checking the cache")).toBeTruthy();
    expect(setSelectedTrace).toHaveBeenLastCalledWith(
      expect.objectContaining({ operationName: "Redis::Get" }),
    );
  });

  it("links a propagated failure to the step that caused it", async () => {
    renderView(failingTrace());
    await userEvent.click(row(/^Step 1:/));
    await userEvent.click(detail().getByRole("button", { name: /Failed because of step 3/ }));
    expect(row(/^Step 3:/).getAttribute("aria-pressed")).toBe("true");
  });

  it("summarises a trace that finished and offers no error filter", () => {
    renderView(okTrace());
    expect(screen.getByText(/Finished without errors/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /path to the error/ })).toBeNull();
    expect(row(/^Step 1:/).getAttribute("aria-pressed")).toBe("true");
  });

  it("filters to the path that leads to the error and back", async () => {
    renderView(failingTrace());
    await userEvent.click(screen.getByRole("button", { name: "Show only the path to the error" }));
    expect(screen.queryByRole("button", { name: /^Step 2:/ })).toBeNull();
    expect(screen.getByText("Step 2 / 2")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Show all steps" }));
    expect(row(/^Step 2:/)).toBeTruthy();
  });

  it("steps through the story and plays it to the end", () => {
    vi.useFakeTimers();
    renderView(failingTrace());
    act(() => screen.getByRole("button", { name: "Previous step" }).click());
    act(() => screen.getByRole("button", { name: "Previous step" }).click());
    expect(screen.getByText("Step 1 / 3")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Previous step" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    act(() => screen.getByRole("button", { name: "Play story" }).click());
    act(() => vi.advanceTimersByTime(PLAY_STEP_MS));
    expect(screen.getByText("Step 2 / 3")).toBeTruthy();
    act(() => vi.advanceTimersByTime(PLAY_STEP_MS));
    expect(screen.getByText("Step 3 / 3")).toBeTruthy();
    act(() => vi.advanceTimersByTime(PLAY_STEP_MS));
    expect(screen.getByRole("button", { name: "Play story" })).toBeTruthy();
    // Playing again from the last step starts over.
    act(() => screen.getByRole("button", { name: "Play story" }).click());
    expect(screen.getByText("Step 1 / 3")).toBeTruthy();
    act(() => screen.getByRole("button", { name: "Pause story" }).click());
    act(() => vi.advanceTimersByTime(PLAY_STEP_MS * 2));
    expect(screen.getByText("Step 1 / 3")).toBeTruthy();
  });

  it("pins facts so they stay visible on other steps, and unpins them", async () => {
    renderView(failingTrace());
    await userEvent.click(detail().getByRole("button", { name: "Pin Collection" }));
    const tray = within(screen.getByRole("region", { name: "Pinned facts" }));
    expect(tray.getByText("#3 Collection: Users")).toBeTruthy();
    await userEvent.click(row(/^Step 1:/));
    expect(tray.getByText("#3 Collection: Users")).toBeTruthy();
    await userEvent.click(tray.getByText("#3 Collection: Users"));
    expect(row(/^Step 3:/).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(detail().getByRole("button", { name: "Unpin Collection" }));
    expect(tray.queryByText("#3 Collection: Users")).toBeNull();
  });

  it("does not invent a cache hit or miss when it was not captured", async () => {
    renderView(failingTrace());
    await userEvent.click(row(/^Step 2:/));
    expect(screen.queryByText(/records a cache hit|records a cache miss/)).toBeNull();
  });

  it("flags spans with no start time instead of drawing them at zero", () => {
    renderView(span({ subEntries: [span({ startTime: "", operationName: "lost" })] }));
    expect(screen.getByText("Time not recorded")).toBeTruthy();
  });

  it("notes truncated traces and clock skew", () => {
    renderView(
      span({
        startTime: at(50),
        subEntries: [span({ startTime: at(10), operationName: "early" })],
      }),
    );
    expect(screen.getByText("clock skew")).toBeTruthy();
    expect(screen.getByText(/1 step start before the step that called them/)).toBeTruthy();
  });
});

describe("TraceStoryView logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.normalLogs.mockReturnValue(logsResult());
    h.restoredLogs.mockReturnValue(logsResult());
  });

  const openLogs = async () => {
    await userEvent.click(detail().getByRole("button", { name: /^Logs/ }));
    return within(screen.getByRole("dialog"));
  };

  it("loads a step's logs only when asked, from the service that ran it", async () => {
    const trace = failingTrace();
    h.normalLogs.mockReturnValue(
      logsResult({
        data: {
          totalCount: 2,
          data: [
            { traceId: "trace-1", timestamp: at(80), level: "Error", message: "Insert failed" },
            { traceId: "trace-1", timestamp: at(30), level: "Information", message: "Inserting" },
          ],
        },
      }),
    );
    renderView(trace);
    expect(h.normalLogs).not.toHaveBeenCalled();
    const sheet = await openLogs();
    const mongo = trace.subEntries[1];
    expect(h.normalLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 0,
        pageSize: LOG_PAGE_SIZE,
        serviceName: mongo.serviceName,
        filter: { traceId: mongo.traceId, spanId: mongo.spanId },
      }),
      { enabled: true },
    );
    const messages = sheet.getAllByText(/Insert/).map((node) => node.textContent);
    // Oldest first, although the API answers newest first.
    expect(messages).toEqual(["Inserting", "Insert failed"]);
    expect(sheet.getByText(/Matched by trace trace-1/)).toBeTruthy();
  });

  it("explains an empty step and offers the calling step and the whole trace", async () => {
    renderView(failingTrace());
    const sheet = await openLogs();
    expect(sheet.getByText("No logs were written during this step.")).toBeTruthy();
    expect(sheet.getByText(/This is a database call/)).toBeTruthy();
    await userEvent.click(sheet.getByRole("button", { name: "Show logs of step 1" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(row(/^Step 1:/).getAttribute("aria-pressed")).toBe("true");

    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Whole trace" }),
    );
    expect(h.normalLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ serviceNames: ["blocks-iam"], filter: { traceId: "trace-1" } }),
      { enabled: true },
    );
  });

  it("links whole-trace records back to their step", async () => {
    const trace = failingTrace();
    const redis = trace.subEntries[0];
    h.normalLogs.mockReturnValue(
      logsResult({
        data: {
          totalCount: 1,
          data: [
            {
              traceId: "trace-1",
              spanId: redis.spanId,
              timestamp: at(11),
              level: "Warning",
              message: "Slow cache",
            },
          ],
        },
      }),
    );
    renderView(trace);
    const sheet = await openLogs();
    await userEvent.click(sheet.getByRole("button", { name: "Whole trace" }));
    await userEvent.click(sheet.getByRole("button", { name: /Step 2 · Redis Get/ }));
    expect(row(/^Step 2:/).getAttribute("aria-pressed")).toBe("true");
    expect(
      within(screen.getByRole("dialog"))
        .getByRole("button", { name: "This step" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("filters to errors on the server", async () => {
    renderView(failingTrace());
    const sheet = await openLogs();
    await userEvent.click(sheet.getByRole("button", { name: "Errors only" }));
    expect(h.normalLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ filter: expect.objectContaining({ level: "Error" }) }),
      { enabled: true },
    );
    expect(sheet.getByText("No errors were logged here.")).toBeTruthy();
  });

  it("uses restored logs for a restored trace", async () => {
    renderView(failingTrace(), { requestId: "restored-42" });
    await openLogs();
    expect(h.normalLogs).toHaveBeenCalledWith(expect.anything(), { enabled: false });
    expect(h.restoredLogs).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "restored-42" }),
      { enabled: true },
    );
  });

  it("announces loading, shows failures, and retries", async () => {
    const refetch = vi.fn();
    h.normalLogs.mockReturnValue(logsResult({ isLoading: true }));
    renderView(failingTrace());
    const sheet = await openLogs();
    expect(sheet.getByRole("status").tagName).toBe("OUTPUT");
    h.normalLogs.mockReturnValue(logsResult({ isError: true, refetch, data: undefined }));
    await userEvent.click(sheet.getByRole("button", { name: "Whole trace" }));
    expect(sheet.getByRole("alert").textContent).toContain("could not be loaded");
    await userEvent.click(sheet.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("pages through many records", async () => {
    h.normalLogs.mockReturnValue(
      logsResult({
        data: {
          totalCount: LOG_PAGE_SIZE + 5,
          data: [{ traceId: "trace-1", timestamp: at(1), level: "Information", message: "one" }],
        },
      }),
    );
    renderView(failingTrace());
    const sheet = await openLogs();
    await userEvent.click(sheet.getByRole("button", { name: "Older records" }));
    expect(h.normalLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1 }),
      expect.anything(),
    );
    expect(
      (sheet.getByRole("button", { name: "Older records" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await userEvent.click(sheet.getByRole("button", { name: "Newer records" }));
    expect(h.normalLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 0 }),
      expect.anything(),
    );
  });

  it("refuses to match logs without a span id", async () => {
    renderView(span({ spanId: "", kind: "Server" }));
    const sheet = await openLogs();
    expect(sheet.getByText(/cannot be matched/)).toBeTruthy();
    expect(h.normalLogs).toHaveBeenCalledWith(expect.anything(), { enabled: false });
  });
});
