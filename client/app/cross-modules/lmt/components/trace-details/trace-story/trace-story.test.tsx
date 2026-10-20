import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

const IAM = "blocks-iam";
const UDS = "blocks-uds";
const MAIL = "mail-svc";
const ALL_OF_IAM = `All of ${IAM}`;
let seq = 0;
const at = (ms: number) => new Date(Date.UTC(2024, 0, 1, 10, 0, 0, ms)).toISOString();
const span = (overrides: Partial<TraceTree> = {}): TraceTree => {
  seq += 1;
  return {
    timestamp: at(0),
    traceId: "trace-1",
    spanId: `span-${seq}`,
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
    serviceName: IAM,
    entryPoint: { method: "POST", actionName: "/oidc/token" },
    issues: [],
    tags: { ecosystem: "", habitat: "", uriClient: "" },
    securityContext: {} as TraceTree["securityContext"],
    request: {} as TraceTree["request"],
    response: {} as TraceTree["response"],
    logs: [],
    subEntries: [],
    ...overrides,
  } as TraceTree;
};

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

const row = (name: RegExp) => screen.getByRole("button", { name });
const isSelected = (name: RegExp) => row(name).getAttribute("aria-pressed") === "true";
const detail = () => within(screen.getByRole("region", { name: "Selected step" }));
const logs = (service = IAM) => within(screen.getByRole("region", { name: `Logs of ${service}` }));
const servicePath = () => within(screen.getByRole("navigation", { name: "Service path" }));

describe("TraceStoryView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.normalLogs.mockReturnValue(logsResult());
    h.restoredLogs.mockReturnValue(logsResult());
  });
  it("shows a placeholder while loading", () => {
    const { container } = renderView(null, { isLoading: true });
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("tells the story in one view: summary, plot line, a sentence and a bar per step", () => {
    renderView(failingTrace());
    expect(screen.getAllByText("/oidc/token").length).toBeGreaterThan(0);
    expect(screen.getAllByText("500").length).toBeGreaterThan(0);
    expect(screen.getByText("It broke in blocks-iam.")).toBeTruthy();
    expect(screen.getAllByText(/E11000 duplicate key/).length).toBeGreaterThan(0);
    expect(row(/^Step 1: The request arrives/)).toBeTruthy();
    expect(row(/^Step 2: Checking the cache/)).toBeTruthy();
    expect(row(/^Step 3: This is where it failed/)).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /Waterfall|Story/ })).toBeNull();
    expect(screen.queryByText(/3D/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Play story|Previous step|Next step/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Pin / })).toBeNull();
    expect(screen.queryByText(/tenant|Trace ID/i)).toBeNull();
  });

  it("opens on the step where the error started and keeps the span panel in sync", async () => {
    const { setSelectedTrace } = renderView(failingTrace());
    expect(isSelected(/^Step 3:/)).toBe(true);
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
    await userEvent.click(detail().getByRole("button", { name: /Show where the error started/ }));
    expect(isSelected(/^Step 3:/)).toBe(true);
  });

  it("summarises a trace that finished and offers no error filter", () => {
    renderView(okTrace());
    expect(screen.getByText(/Finished without errors/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /path to the error/ })).toBeNull();
    expect(isSelected(/^Step 1:/)).toBe(true);
  });

  it("filters to the path that leads to the error and back", async () => {
    renderView(failingTrace());
    await userEvent.click(screen.getByRole("button", { name: "Only the path to the error" }));
    expect(screen.queryByRole("button", { name: /^Step 2:/ })).toBeNull();
    // Rows keep their numbers in the service while others are hidden.
    expect(row(/^Step 3:/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Show all steps" }));
    expect(row(/^Step 2:/)).toBeTruthy();
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

const multiServiceTrace = () =>
  span({
    kind: "Server",
    operationName: "POST /oidc/token",
    duration: 400,
    attributes: { "response.status.code": 500 },
    status: "Unset",
    subEntries: [
      span({
        operationName: "GET /uds/profile",
        kind: "Client",
        startTime: at(10),
        duration: 90,
        subEntries: [
          span({
            serviceName: UDS,
            kind: "Server",
            operationName: "GET /uds/profile",
            startTime: at(12),
            duration: 80,
            subEntries: [
              span({
                serviceName: UDS,
                operationName: "MongoDb::find",
                kind: "Client",
                startTime: at(20),
                duration: 30,
              }),
            ],
          }),
        ],
      }),
      span({
        operationName: "publish iam.login",
        kind: "Producer",
        startTime: at(120),
        duration: 4,
        attributes: { "messaging.system": "rabbitmq", "messaging.destination.name": "iam.login" },
        subEntries: [
          span({
            serviceName: MAIL,
            kind: "Consumer",
            operationName: "consume iam.login",
            startTime: at(2520),
            duration: 60,
            status: "Error",
            statusDescription: "SMTP refused",
            attributes: {
              "messaging.system": "rabbitmq",
              "messaging.destination.name": "iam.login",
            },
          }),
        ],
      }),
    ],
  });

describe("TraceStoryView services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.normalLogs.mockReturnValue(logsResult());
    h.restoredLogs.mockReturnValue(logsResult());
  });

  it("shows one service at a time and lists every service of the trace", () => {
    renderView(multiServiceTrace());
    const services = within(screen.getByRole("navigation", { name: "Services" }));
    expect(services.getByRole("button", { name: /blocks-iam/ })).toBeTruthy();
    expect(services.getByRole("button", { name: /blocks-uds/ })).toBeTruthy();
    expect(services.getByRole("button", { name: /mail-svc.*event/ })).toBeTruthy();
    // The error is in mail-svc, so the story opens there.
    expect(servicePath().getByText("mail-svc (event)")).toBeTruthy();
    expect(screen.getByText(/This event ran 2\.40 s after blocks-iam published it/)).toBeTruthy();
  });

  it("opens a called service in place of the list and goes back up", async () => {
    renderView(multiServiceTrace());
    await userEvent.click(servicePath().getByRole("button", { name: IAM }));
    expect(screen.queryByRole("button", { name: /MongoDb|Looking up the data/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /Open blocks-uds · 2 steps/ }));
    expect(servicePath().getByText(UDS)).toBeTruthy();
    expect(row(/^Step 2: Looking up the data/)).toBeTruthy();
    expect(logs(UDS).getByRole("button", { name: "All of blocks-uds" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Back to the calling service" }));
    expect(servicePath().getByText(IAM)).toBeTruthy();
    // Coming back up selects the step that led down.
    expect(isSelected(/^Step 2:/)).toBe(true);
  });

  it("marks an event with its delay and a failing service in red", async () => {
    renderView(multiServiceTrace());
    await userEvent.click(
      within(screen.getByRole("navigation", { name: "Services" })).getByRole("button", {
        name: /blocks-iam/,
      }),
    );
    expect(screen.getByText("→ +2.40 s")).toBeTruthy();
    const open = screen.getByRole("button", { name: /Open mail-svc · 1 step/ });
    expect(open.className).toContain("text-error");
    expect(open.className).toContain("border-dashed");
    await userEvent.click(open);
    expect(servicePath().getByText("mail-svc (event)")).toBeTruthy();
  });

  it("asks for the logs of the whole service, not the whole trace", async () => {
    renderView(multiServiceTrace());
    await userEvent.click(logs(MAIL).getByRole("button", { name: "All of mail-svc" }));
    expect(h.normalLogs).toHaveBeenLastCalledWith(
      { page: 0, pageSize: LOG_PAGE_SIZE, serviceName: MAIL, filter: { traceId: "trace-1" } },
      { enabled: true },
    );
  });
});

describe("TraceStoryView logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.normalLogs.mockReturnValue(logsResult());
    h.restoredLogs.mockReturnValue(logsResult());
  });

  const openLogs = async () => logs();

  it("shows a step's logs in the page, from the service that ran it", async () => {
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
    // Times count from the start of the trace.
    expect(sheet.getByText("+30.00 ms")).toBeTruthy();
    expect(sheet.getByText(/matched by trace trace-1/)).toBeTruthy();
  });

  it("explains an empty step and offers the calling step and the whole service", async () => {
    renderView(failingTrace());
    const sheet = await openLogs();
    expect(sheet.getByText("No logs were written during this step.")).toBeTruthy();
    expect(sheet.getByText(/This is a database call/)).toBeTruthy();
    await userEvent.click(
      sheet.getByRole("button", { name: "Show logs of the step that called it" }),
    );
    expect(isSelected(/^Step 1:/)).toBe(true);

    await userEvent.click(logs().getByRole("button", { name: "Show all logs of blocks-iam" }));
    expect(h.normalLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ serviceName: IAM, filter: { traceId: "trace-1" } }),
      { enabled: true },
    );
    expect(logs().getByText("blocks-iam wrote no logs in this trace.")).toBeTruthy();
  });

  it("links a service's records back to their step", async () => {
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
    await userEvent.click(sheet.getByRole("button", { name: ALL_OF_IAM }));
    await userEvent.click(sheet.getByRole("button", { name: /Go to step: Redis Get/ }));
    expect(isSelected(/^Step 2:/)).toBe(true);
    expect(logs().getByRole("button", { name: "This step" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("filters to errors on the server", async () => {
    renderView(failingTrace());
    const sheet = await openLogs();
    await userEvent.click(sheet.getByRole("checkbox", { name: "Errors only" }));
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
    h.normalLogs.mockReturnValue(logsResult({ isError: true, refetch, data: null }));
    await userEvent.click(sheet.getByRole("button", { name: ALL_OF_IAM }));
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
