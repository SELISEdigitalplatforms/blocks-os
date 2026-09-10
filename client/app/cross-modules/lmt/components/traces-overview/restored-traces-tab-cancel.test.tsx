import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRACE_REQUEST_SOURCE_TYPE, TRACE_REQUEST_STATUS } from "@blocks-lmt/constants/trace.constant";

const h = vi.hoisted(() => ({
  getRequestId: vi.fn(),
  getTraceStatus: vi.fn(),
  cancelRestoreRequest: vi.fn(),
  getRestoredTraces: vi.fn(),
  getRetentionDays: vi.fn(),
  showErrorToast: vi.fn(),
}));

vi.mock("react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@seliseblocks/genesis-os/hooks", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useIsMobile: () => false, useScopedPath: () => (p: string) => `/lmt/${p}` };
});
vi.mock("@seliseblocks/genesis-os/store", () => ({
  useAuthStore: () => ({ user: { email: "tester@example.com" } }),
}));
vi.mock("@/hooks/use-toast", () => ({ showErrorToast: h.showErrorToast }));
vi.mock("@blocks-lmt/hooks/use-trace", () => ({
  useGetRequestId: () => ({ mutateAsync: h.getRequestId }),
  useGetTraceStatus: () => ({ mutateAsync: h.getTraceStatus }),
  useStartColdTrace: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useStartArchiveTrace: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCancelRestoreRequest: () => ({ mutateAsync: h.cancelRestoreRequest, isPending: false }),
  useGetRestoredTraces: () => h.getRestoredTraces(),
  useGetRestoredDataRetentionDays: () => h.getRetentionDays(),
}));

import { RestoredTracesTab } from "./restored-traces-tab";

const makeWrapper = () => {
  const Wrapper = ({ children }: { children: ReactNode }) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    return (
      <QueryClientProvider client={qc}>
        <NuqsTestingAdapter>{children}</NuqsTestingAdapter>
      </QueryClientProvider>
    );
  };
  return Wrapper;
};

const renderTab = () =>
  render(
    <RestoredTracesTab
      sourceType={TRACE_REQUEST_SOURCE_TYPE.cold}
      projectKey="proj-1"
      queryParams={{ page: 0, pageSize: 10, search: "" } as never}
      setQueryParams={vi.fn() as never}
      sortQueryParams={{ property: "timestamp", isDescending: true }}
      serviceOptions={[]}
      serviceLabels={new Map()}
      selectedServiceNames={[]}
      hasActiveFilter={false}
    />,
    { wrapper: makeWrapper() },
  );

describe("RestoredTracesTab cancellation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.getRequestId.mockResolvedValue({ requestId: "req-1" });
    h.getTraceStatus.mockResolvedValue({ status: TRACE_REQUEST_STATUS.processing });
    h.getRestoredTraces.mockReturnValue({ data: undefined, isLoading: false, isFetching: false });
    h.getRetentionDays.mockReturnValue({ data: undefined });
  });

  it("offers cancellation while a request is in progress", async () => {
    renderTab();

    expect(await screen.findByRole("button", { name: /cancel request/i })).toBeTruthy();
  });

  it("cancels the in-flight request once the user confirms", async () => {
    h.cancelRestoreRequest.mockResolvedValue({
      requestId: "req-1",
      status: TRACE_REQUEST_STATUS.cancelled,
      cancelled: true,
      message: "Restore request cancelled.",
    });

    renderTab();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /cancel request/i }));
    // The confirm dialog's own button carries the same label, so scope to the dialog.
    const dialog = await screen.findByRole("dialog");
    await user.click(await within(dialog).findByRole("button", { name: /cancel request/i }));

    await waitFor(() =>
      expect(h.cancelRestoreRequest).toHaveBeenCalledWith({ RequestId: "req-1" }),
    );
  });

  it("does not cancel anything until the user confirms", async () => {
    renderTab();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /cancel request/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /keep running/i }));

    expect(h.cancelRestoreRequest).not.toHaveBeenCalled();
  });

  it("tells the user when the restore had already finished", async () => {
    h.cancelRestoreRequest.mockResolvedValue({
      requestId: "req-1",
      status: TRACE_REQUEST_STATUS.completed,
      cancelled: false,
      message: "Restore request is already Completed and cannot be cancelled.",
    });

    renderTab();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /cancel request/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(await within(dialog).findByRole("button", { name: /cancel request/i }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({
        errors: "Restore request is already Completed and cannot be cancelled.",
      }),
    );
  });

  it("shows a cancelled state that lets the user request again", async () => {
    h.getTraceStatus.mockResolvedValue({ status: TRACE_REQUEST_STATUS.cancelled });

    renderTab();

    expect(await screen.findByText(/request cancelled/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /request cold traces/i })).toBeTruthy();
  });
});
