import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TraceTree } from "@blocks-lmt/models/trace.model";

const h = vi.hoisted(() => ({
  trace: null as TraceTree | null,
  isLoading: false,
  isFetching: false,
  isError: false,
  isMobile: false,
  logs: [] as unknown[],
  logsLoading: false,
  tenantId: "tenant-1",
  getLogs: vi.fn(),
  getRestoredLogs: vi.fn(),
}));

vi.mock("@/hooks/use-lmt-base-path", () => ({
  useLmtBasePath: () => "/app/lmt",
}));
vi.mock("@seliseblocks/genesis-os/hooks", () => ({
  useIsMobile: () => h.isMobile,
  usePathSegments: () => [],
}));
vi.mock("@seliseblocks/genesis-os", async () => {
  const React = await import("react");
  const Pass = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  return {
    useProjectStore: () => ({ selectedProject: { tenantId: h.tenantId } }),
    Tooltip: Pass,
    TooltipTrigger: Pass,
    TooltipContent: Pass,
    TooltipProvider: Pass,
  };
});
vi.mock("@blocks-lmt/hooks/use-trace", () => ({
  useGetTraceById: () => ({
    isLoading: h.isLoading,
    isFetching: h.isFetching,
    isError: h.isError,
    data: h.trace ? { data: h.trace } : undefined,
  }),
  // Not exercised by these tests -- none pass a `requestId` search param -- but the component
  // calls it unconditionally, so the mock module must still export it.
  useGetRestoredTraceById: () => ({
    isLoading: false,
    isFetching: false,
    isError: h.isError,
    data: h.trace ? { data: h.trace } : undefined,
  }),
}));
vi.mock("@blocks-lmt/hooks/use-log", () => ({
  useGetLogs: h.getLogs,
  useGetRestoredLogs: h.getRestoredLogs,
}));

import { TraceDetails } from "./trace-details";

const childTrace = (): TraceTree =>
  ({
    timestamp: "2024-01-01T10:00:00.000Z",
    traceId: "trace-1",
    spanId: "span-child",
    parentSpanId: "span-root",
    parentId: "span-root",
    kind: "Internal",
    activitySourceName: "DB",
    operationName: "Query",
    startTime: "2024-01-01T10:00:00.200Z",
    endTime: "2024-01-01T10:00:00.500Z",
    duration: 30,
    attributes: {},
    status: "OK",
    statusDescription: "",
    baggage: { TenantId: "t", IsFromCloud: "false" },
    serviceName: "blocks-data",
    entryPoint: { method: "GET", actionName: "Query" },
    issues: [],
    tags: { ecosystem: "", habitat: "", uriClient: "" },
    securityContext: {} as TraceTree["securityContext"],
    request: {} as TraceTree["request"],
    response: {} as TraceTree["response"],
    logs: [],
    subEntries: [],
  }) as TraceTree;

const rootTrace = (): TraceTree =>
  ({
    ...childTrace(),
    spanId: "span-root",
    parentSpanId: "",
    parentId: "parent-1",
    kind: "Server",
    activitySourceName: "IAM",
    operationName: "GetUser",
    startTime: "2024-01-01T10:00:00.000Z",
    endTime: "2024-01-01T10:00:01.000Z",
    duration: 100,
    attributes: { "http.method": "GET", dbName: "users" },
    serviceName: "blocks-iam",
    entryPoint: { method: "GET", actionName: "GetUser" },
    subEntries: [childTrace()],
  }) as TraceTree;

const renderPage = (id = "trace-1") =>
  render(
    <MemoryRouter>
      <TraceDetails id={id} />
    </MemoryRouter>,
  );

const renderRestoredPage = (id = "trace-1") =>
  render(
    <MemoryRouter initialEntries={[`/tracing/${id}?requestId=request-1`]}>
      <TraceDetails id={id} />
    </MemoryRouter>,
  );

describe("TraceDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.trace = rootTrace();
    h.isLoading = false;
    h.isFetching = false;
    h.isError = false;
    h.isMobile = false;
    h.logs = [
      {
        timestamp: "2024-01-01T10:00:00.000Z",
        level: "INFO",
        traceId: "trace-1",
        message: "hello world",
      },
    ];
    h.logsLoading = false;
    h.tenantId = "tenant-1";
    h.getLogs.mockImplementation(() => ({
      isLoading: h.logsLoading,
      isFetching: false,
      data: { data: h.logs },
    }));
    h.getRestoredLogs.mockImplementation(() => ({
      isLoading: h.logsLoading,
      isFetching: false,
      data: { data: h.logs },
    }));
  });

  it("shows a not-found state when no trace exists", () => {
    h.trace = null;
    renderPage();
    expect(screen.getByText("Trace not found")).toBeTruthy();
  });

  it("shows an error state when the request errored", () => {
    h.trace = null;
    h.isError = true;
    renderPage();
    expect(screen.getByText("Unable to load trace")).toBeTruthy();
  });

  it("shows loading skeletons while fetching", () => {
    h.trace = null;
    h.isLoading = true;
    const { container } = renderPage();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders the trace as one story view", async () => {
    renderPage();
    expect(await screen.findByRole("region", { name: "Trace story" })).toBeTruthy();
    expect(screen.getAllByText(/GetUser/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^Open blocks-data · 1 step/ })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /Waterfall|Story/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Download JSON/i })).toBeTruthy();
  });

  it("downloads the trace as a JSON file", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => "blob:trace");
    const revokeObjectURL = vi.fn();
    (URL as unknown as { createObjectURL: unknown }).createObjectURL = createObjectURL;
    (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = revokeObjectURL;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    renderPage();
    await user.click(await screen.findByRole("button", { name: /Download JSON/i }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });

  it("shows the selected span's technical details", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /^Open blocks-data/ }));
    await user.click(screen.getByText("Technical details"));
    expect(screen.getAllByText("blocks-data").length).toBeGreaterThan(0);
  });

  it("shows the logs of the selected step in the page", async () => {
    renderPage();
    expect(await screen.findByText(/hello world/)).toBeTruthy();
    expect(h.getLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceName: "blocks-iam",
        filter: { traceId: "trace-1", spanId: "span-root" },
      }),
      expect.objectContaining({ enabled: true }),
    );
  });

  it("uses restored logs when a restored request id is present", async () => {
    renderRestoredPage();
    await screen.findByRole("region", { name: "Logs of blocks-iam" });

    expect(h.getRestoredLogs).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "request-1" }),
      expect.objectContaining({ enabled: true }),
    );
    expect(h.getLogs).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ enabled: false }),
    );
  });
});
