import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  useGetTraces: vi.fn(),
  isMobile: false,
  navigate: vi.fn(),
  getAllServices: vi.fn(),
}));

vi.mock("react-router", () => ({ useNavigate: () => h.navigate }));
vi.mock("@seliseblocks/genesis-os/hooks", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useIsMobile: () => h.isMobile,
    useScopedPath: () => (p: string) => `/lmt-base/${p}`,
  };
});
vi.mock("@blocks-lmt/hooks/use-trace", () => ({
  useGetTraces: (opt: unknown) => h.useGetTraces(opt),
}));
vi.mock("@/cross-modules/identifier/services/service-registry.service", () => ({
  serviceRegistryService: { getAllServices: (args: unknown) => h.getAllServices(args) },
}));
// Heavy, separately-tested widgets.
vi.mock("@blocks-ai/components/lmt-query-agent/lmt-query-agent-sheet", () => ({
  LMTQueryAgentSheet: () => <div data-testid="agent-sheet" />,
}));
vi.mock("@blocks-lmt/components/trace-guideline/trace-provider-guideline", () => ({
  TraceProviderSetupGuideLine: ({ open }: { open: boolean }) => (
    <div data-testid="guideline" data-open={String(open)} />
  ),
}));

import { TracesOverview } from "./traces-overview";

const trace = {
  traceId: "trace-1",
  entryPoint: { method: "get", actionName: "GetUsers" },
  serviceName: "svc-1",
  duration: "125",
  timestamp: "2024-06-01T12:00:00Z",
};

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <QueryClientProvider client={qc}>
      <NuqsTestingAdapter>{children}</NuqsTestingAdapter>
    </QueryClientProvider>
  );
};

const renderOverview = () => render(<TracesOverview projectKey="proj-1" />, { wrapper });

describe("TracesOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isMobile = false;
    h.getAllServices.mockResolvedValue({
      data: [{ name: "Service One", serviceId: "svc-1" }],
    });
    h.useGetTraces.mockReturnValue({
      data: { data: [trace], totalCount: 1 },
      isLoading: false,
      isFetching: false,
    });
  });

  it("renders the page header and the three trace mode cards", () => {
    renderOverview();
    expect(screen.getByText("Tracing")).toBeTruthy();
    expect(screen.getByText("Hot")).toBeTruthy();
    expect(screen.getByText("Cold")).toBeTruthy();
    expect(screen.getByText("Archive")).toBeTruthy();
  });

  it("renders a loading skeleton while traces load", () => {
    h.useGetTraces.mockReturnValue({ data: undefined, isLoading: true, isFetching: false });
    renderOverview();
    expect(document.body.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThan(0);
  });

  it("renders trace rows with the resolved service label", async () => {
    renderOverview();
    expect(await screen.findByText("GetUsers")).toBeTruthy();
    expect(screen.getByText("get")).toBeTruthy();
    expect(screen.getByText("125ms")).toBeTruthy();
    // Registered service name resolves from the serviceId.
    await waitFor(() => expect(screen.getByText("Service One")).toBeTruthy());
  });

  it("shows the no-data state when there are no traces and no filter", () => {
    h.useGetTraces.mockReturnValue({
      data: { data: [], totalCount: 0 },
      isLoading: false,
      isFetching: false,
    });
    renderOverview();
    expect(screen.getByText("No data found.")).toBeTruthy();
  });

  it("shows the no-results state when the filter returns nothing", async () => {
    const user = userEvent.setup();
    h.useGetTraces.mockReturnValue({
      data: { data: [], totalCount: 0 },
      isLoading: false,
      isFetching: false,
    });
    renderOverview();
    const search = (await screen.findAllByPlaceholderText("Search..."))[0];
    await user.type(search, "missing");
    await waitFor(() => expect(screen.getByText("No results found.")).toBeTruthy());
  });

  it("navigates to the trace detail when a row is clicked", async () => {
    const user = userEvent.setup();
    renderOverview();
    const row = (await screen.findByText("GetUsers")).closest("tr") as HTMLElement;
    await user.click(row);
    expect(h.navigate).toHaveBeenCalledWith("/lmt-base/lmt/tracing/trace-1");
  });

  it("switches to the cold tab and shows the coming-soon placeholder", async () => {
    const user = userEvent.setup();
    renderOverview();
    await user.click(screen.getByText("Cold"));
    expect(await screen.findAllByText("Coming soon")).toBeTruthy();
  });

  it("toggles the setup guideline open when the guide button is pressed", async () => {
    const user = userEvent.setup();
    renderOverview();
    expect(screen.getByTestId("guideline").getAttribute("data-open")).toBe("false");
    await user.click(screen.getByRole("button", { name: /Guide/i }));
    await waitFor(() =>
      expect(screen.getByTestId("guideline").getAttribute("data-open")).toBe("true"),
    );
  });

  it("renders a mode dropdown instead of cards on mobile", () => {
    h.isMobile = true;
    renderOverview();
    // The mobile layout swaps the card grid for a Select combobox.
    expect(screen.getByRole("combobox")).toBeTruthy();
    // The guideline is not mounted on mobile.
    expect(screen.queryByTestId("guideline")).toBeNull();
  });
});
