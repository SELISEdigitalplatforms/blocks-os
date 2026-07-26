import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
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
}));

vi.mock("@/hooks/use-lmt-base-path", () => ({
  useLmtBasePath: () => "/app/lmt",
}));
vi.mock("@seliseblocks/blocks-kit/hooks", () => ({
  useIsMobile: () => h.isMobile,
  usePathSegments: () => [],
}));
vi.mock("@seliseblocks/blocks-kit", async () => {
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
}));
vi.mock("@blocks-lmt/hooks/use-log", () => ({
  useGetLogs: () => ({ isLoading: h.logsLoading, isFetching: false, data: { data: h.logs } }),
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

describe("TraceDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.trace = rootTrace();
    h.isLoading = false;
    h.isFetching = false;
    h.isError = false;
    h.isMobile = false;
    h.logs = [{ timestamp: "2024-01-01T10:00:00.000Z", level: "INFO", traceId: "trace-1", message: "hello world" }];
    h.logsLoading = false;
    h.tenantId = "tenant-1";
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

  it("renders the timeline, insights and activity logs for a trace", async () => {
    renderPage();
    expect(await screen.findByText("Timeline")).toBeTruthy();
    // trace id shown in the header
    expect(screen.getAllByText("trace-1").length).toBeGreaterThan(0);
    // insights info tab shows the entry point action
    expect(screen.getAllByText(/GetUser/).length).toBeGreaterThan(0);
    // activity log lists the root activity source
    expect(screen.getAllByText(/IAM/).length).toBeGreaterThan(0);
    // download button available
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

  it("switches to the log tab and lists log entries", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Timeline");

    await user.click(screen.getByRole("tab", { name: "Log" }));
    expect(await screen.findByText(/hello world/)).toBeTruthy();
  });

  it("shows an empty log state when there are no logs", async () => {
    const user = userEvent.setup();
    h.logs = [];
    renderPage();
    await screen.findByText("Timeline");

    await user.click(screen.getByRole("tab", { name: "Log" }));
    expect(await screen.findByText("No data")).toBeTruthy();
  });

  it("collapses the insights panel when toggled", async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    await screen.findByText("Timeline");

    // Info/Log tabs are visible while the panel is open
    expect(screen.getByRole("tab", { name: "Info" })).toBeTruthy();

    // the panel toggle is the icon-only button rendering the PanelRightClose icon
    const toggle = container
      .querySelector(".lucide-panel-right-close")
      ?.closest("button") as HTMLButtonElement;
    await user.click(toggle);

    await waitFor(() => expect(screen.queryByRole("tab", { name: "Info" })).toBeNull());
  });

  it("selects a sub-entry from the activity log", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Timeline");

    // the child sub-entry activity source is clickable
    const child = screen.getByText(/DB/);
    await user.click(child);
    // still renders after selection change
    expect(screen.getByText("Timeline")).toBeTruthy();
  });
});
